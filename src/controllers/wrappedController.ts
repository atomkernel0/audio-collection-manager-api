import { Context } from "vm";
import { verifyToken } from "../utils";
import { AlbumModel } from "../models/album.model";
import { IAlbum } from "../interfaces/album.interface";
import { UserModel } from "../models/user.model";
import { ApiError, ApiErrors } from "../interfaces/api-errors.interface";

// Interfaces
interface PercentileResult {
  albumId: string;
  artist: string[];
  percentile: number;
  topPercentage: number;
  totalListens: number;
}

interface WrappedSong {
  title: string;
  artist: string;
  playCount: number;
}

interface WrappedAlbum {
  title: string;
  artist: string[];
  coverUrl: string;
  playCount: number;
}

interface WrappedStats {
  totalMinutes: number;
  percentile: number;
  topSongs: WrappedSong[];
  topAlbums: WrappedAlbum[];
  languageBreakdown: { [key: string]: number };
  listeningTimes: {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
  };
  topPerformances?: {
    artist: string[];
    message: string;
    totalListens: number;
  }[];
}

export async function getWrapped(ctx: Context) {
  const token = ctx.request.headers.authorization?.split(" ")[1];

  if (!token) {
    return handleApiError(ctx, ApiErrors.UNAUTHORIZED);
  }

  try {
    const decoded = verifyToken(token);
    const userId = decoded.userId;

    const user = await UserModel.findById(userId);
    if (!user) {
      return handleApiError(ctx, ApiErrors.USER_NOT_FOUND);
    }

    const albums = await AlbumModel.find({
      _id: { $in: user.listenedAlbums.map((la) => la.albumId) },
    });

    const albumMap = new Map(albums.map((album) => [album._id, album]));

    const currentYear = new Date().getFullYear();
    const startDate = new Date(currentYear, 0, 1);
    const endDate = new Date(currentYear, 11, 31);

    const listenedSongs = user.listenedSongs.filter((song) =>
      song.listenHistory.some((date) => date >= startDate && date <= endDate)
    );

    const listenedAlbums = user.listenedAlbums.filter((album) =>
      album.listenHistory.some((date) => date >= startDate && date <= endDate)
    );

    // Calculer les percentiles avant de les utiliser
    const percentiles = await calculateListeningPercentiles(ctx, albumMap);

    const stats = {
      topSongs: calculateTopSongs(listenedSongs, albumMap),
      topAlbums: calculateTopAlbums(listenedAlbums, albumMap),
      languageBreakdown: calculateLanguageBreakdown(listenedAlbums, albumMap),
      totalListens: listenedSongs.reduce(
        (total, song) => total + song.playCount,
        0
      ),
      listeningTimes: calculateListeningTimes(listenedSongs),
      totalMinutes: Math.round(
        listenedSongs.reduce((total, song) => total + song.playCount * 3, 0)
      ),
      percentile: calculateGlobalPercentile(percentiles), // Nouvelle fonction à implémenter
    };

    const topPerformances =
      percentiles && Array.isArray(percentiles)
        ? percentiles
            // .filter((p) => p.topPercentage >= 90)
            .map((p) => ({
              artist: p.artist,
              message: `Vous faites partie des ${
                p.topPercentage
              }% des plus grands auditeurs de ${p.artist.join(" & ")}!`,
              totalListens: p.totalListens,
            }))
        : [];

    ctx.status = 200;
    ctx.body = {
      wrapped: {
        ...stats,
        topPerformances,
      },
    };
  } catch (error) {
    console.error("Error in getWrapped:", error);
    return handleApiError(ctx, ApiErrors.INTERNAL_ERROR);
  }
}

function calculateGlobalPercentile(percentiles: PercentileResult[]): number {
  if (!percentiles || !percentiles.length) return 0.1;

  const sortedPercentiles = [...percentiles].sort(
    (a, b) => a.percentile - b.percentile
  );

  const bestPercentile = sortedPercentiles[0].percentile;

  return Math.max(0.1, bestPercentile);
}

function calculateTopSongs(
  listenedSongs: any[],
  albumMap: Map<string, IAlbum>
): WrappedSong[] {
  return listenedSongs
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, 5)
    .map((song) => {
      const album = albumMap.get(song.albumId.toString());

      return {
        title: song.songTitle,
        artist: album?.artist?.join(" & ") || "Artiste Inconnu",
        playCount: song.playCount,
      };
    });
}

function calculateTopAlbums(
  listenedAlbums: any[],
  albumMap: Map<string, IAlbum>
): WrappedAlbum[] {
  return listenedAlbums
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, 5)
    .map((album) => {
      const albumData = albumMap.get(album.albumId.toString());

      const formattedCover = albumData?.cover
        ? !albumData.cover.startsWith("http")
          ? encodeURI(`${process.env.CDN_URL}/${albumData.cover}`)
          : albumData.cover
        : "/assets/default-cover.jpg";

      return {
        title: albumData?.title || "Unknown",
        artist: albumData?.artist || [],
        coverUrl: formattedCover,
        playCount: album.playCount,
      };
    });
}

function calculateListeningTimes(listenedSongs: any[]) {
  const times = {
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0,
  };

  listenedSongs.forEach((song) => {
    song.listenHistory.forEach((date: Date) => {
      const hour = new Date(date).getHours();
      if (hour >= 6 && hour < 12) times.morning++;
      else if (hour >= 12 && hour < 18) times.afternoon++;
      else if (hour >= 18) times.evening++;
      else times.night++;
    });
  });

  return times;
}

async function calculateListeningPercentiles(
  ctx: Context,
  albumMap: Map<string, any>
): Promise<PercentileResult[]> {
  const token = ctx.request.headers.authorization?.split(" ")[1];
  if (!token) return [];

  try {
    const decoded = verifyToken(token);
    const userId = decoded.userId;

    const userStats = await calculateUserListeningStats(userId, albumMap);
    const allUsersStats = await calculateAllUsersStats(albumMap);

    return calculatePercentiles(userStats, allUsersStats, albumMap);
  } catch (error) {
    console.error("Error calculating percentiles:", error);
    return [];
  }
}

async function calculateUserListeningStats(
  userId: string,
  albumMap: Map<string, any>
) {
  const user = await UserModel.findById(userId);
  if (!user) return [];

  return user.listenedAlbums.map((album) => ({
    albumId: album.albumId.toString(),
    playCount: album.playCount,
    artist: albumMap.get(album.albumId.toString())?.artist || [],
  }));
}

async function calculateAllUsersStats(albumMap: Map<string, any>) {
  const allUsers = await UserModel.find({});

  return allUsers.flatMap((user) =>
    user.listenedAlbums.map((album) => ({
      userId: user._id.toString(),
      albumId: album.albumId.toString(),
      playCount: album.playCount,
      artist: albumMap.get(album.albumId.toString())?.artist || [],
    }))
  );
}

function calculatePercentiles(
  userStats: any[],
  allUsersStats: any[],
  albumMap: Map<string, any>
): PercentileResult[] {
  // Calculer le total des écoutes par utilisateur
  const totalListensByUser = new Map<string, number>();

  allUsersStats.forEach((stat) => {
    const userId = stat.userId;
    totalListensByUser.set(
      userId,
      (totalListensByUser.get(userId) || 0) + stat.playCount
    );
  });

  // Trouver la position de l'utilisateur dans le classement global
  const allTotals = Array.from(totalListensByUser.values()).sort(
    (a, b) => b - a
  );
  const userTotal = userStats.reduce((sum, stat) => sum + stat.playCount, 0);
  const userRank = allTotals.findIndex((total) => total <= userTotal) + 1;

  return userStats.map((userStat) => {
    const albumId = userStat.albumId;
    const userCount = userStat.playCount;

    // Compter combien d'utilisateurs écoutent moins que lui pour cet album
    const betterThan = allUsersStats.filter(
      (stat) => stat.albumId === albumId && stat.playCount < userCount
    ).length;

    const totalListeners = allUsersStats.filter(
      (stat) => stat.albumId === albumId
    ).length;

    // Assurer un minimum de 0.1% pour les albums aussi
    const albumPercentile = Math.max(
      0.1,
      Math.round((betterThan / totalListeners) * 100)
    );

    return {
      albumId,
      artist: albumMap.get(albumId)?.artist || [],
      percentile: albumPercentile,
      topPercentage: albumPercentile,
      totalListens: userCount,
    };
  });
}

function calculateLanguageBreakdown(
  listenedAlbums: any[],
  albumMap: Map<string, any>
) {
  const langCounts: { [key: string]: number } = {};

  listenedAlbums.forEach((album) => {
    const albumLang = albumMap.get(album.albumId.toString())?.lang;
    if (albumLang) {
      langCounts[albumLang] = (langCounts[albumLang] || 0) + album.playCount;
    }
  });

  return langCounts;
}

function handleApiError(ctx: Context, error: ApiError): void {
  ctx.status = error.status;
  ctx.body = { error: error.message, code: error.code };
}
