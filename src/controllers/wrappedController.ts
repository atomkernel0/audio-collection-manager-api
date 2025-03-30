import { Context } from "koa";
import { verifyToken } from "../utils";
import { AlbumModel } from "../models/album.model";
import { IAlbum } from "../interfaces/album.interface";
import {
  IUser,
  ListenedAlbumStats,
  ListenedSongStats,
} from "../interfaces/user.interface";
import { UserModel } from "../models/user.model";
import { ApiError, ApiErrors } from "../interfaces/api-errors.interface";

interface PercentileResult {
  albumId: string;
  artist: string[];
  percentile: number;
  topPercent: number;
  totalListens: number;
}

interface AggregatedArtistStat {
  artistName: string;
  totalListens: number;
  bestPercentile: number;
  albumIds: string[];
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
    artistName: string;
    message: string;
    totalListens: number;
  }[];
}

const DEFAULT_SONG_DURATION_MINUTES = 3;
const TOP_PERFORMANCE_PERCENTILE_THRESHOLD = 10;
const MIN_TOP_PERCENT = 0.1;

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

    const albumMap = new Map(
      albums.map((album) => [album._id.toString(), album])
    );

    const currentYear = new Date().getFullYear();
    const startDate = new Date(currentYear, 0, 1);
    const endDate = new Date(currentYear + 1, 0, 1);

    const yearlyListenedSongs = user.listenedSongs.filter((song) =>
      song.listenHistory.some((date) => date >= startDate && date < endDate)
    );

    const yearlyListenedAlbums = user.listenedAlbums.filter((album) =>
      album.listenHistory.some((date) => date >= startDate && date < endDate)
    );

    const userAlbumPercentiles = await calculateListeningPercentiles(
      user,
      albumMap
    );

    const aggregatedArtistStats = aggregateArtistStats(userAlbumPercentiles);

    const totalYearlyListens = yearlyListenedSongs.reduce(
      (total, song) => total + song.playCount,
      0
    );
    const totalYearlyMinutes = Math.round(
      yearlyListenedSongs.reduce(
        (total, song) => total + song.playCount * DEFAULT_SONG_DURATION_MINUTES,
        0
      )
    );

    const stats = {
      topSongs: calculateTopSongs(yearlyListenedSongs, albumMap),
      topAlbums: calculateTopAlbums(yearlyListenedAlbums, albumMap),
      languageBreakdown: calculateLanguageBreakdown(
        yearlyListenedAlbums,
        albumMap
      ),
      totalListens: totalYearlyListens,
      listeningTimes: calculateListeningTimes(yearlyListenedSongs),
      totalMinutes: totalYearlyMinutes,
      percentile: calculateGlobalPercentile(aggregatedArtistStats),
    };

    const topPerformances = aggregatedArtistStats
      .filter(
        (stat) => stat.bestPercentile <= TOP_PERFORMANCE_PERCENTILE_THRESHOLD
      )
      .sort((a, b) => a.bestPercentile - b.bestPercentile)
      .map((stat) => {
        let roundedTopPercent;
        if (stat.bestPercentile === 0) {
          roundedTopPercent = MIN_TOP_PERCENT;
        } else {
          const displayTopPercent = Math.max(
            MIN_TOP_PERCENT,
            100 - stat.bestPercentile
          );
          roundedTopPercent = Math.round(displayTopPercent * 10) / 10;
        }

        return {
          artistName: stat.artistName,
          message: `Vous faites partie du top ${roundedTopPercent}% des plus grands auditeurs de ${stat.artistName} !`,
          totalListens: stat.totalListens,
        };
      });

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

function calculateGlobalPercentile(
  aggregatedStats: AggregatedArtistStat[]
): number {
  if (!aggregatedStats || aggregatedStats.length === 0) {
    return 50;
  }

  const bestPercentile = Math.min(
    ...aggregatedStats.map((stat) => stat.bestPercentile)
  );

  if (bestPercentile === 0) {
    return MIN_TOP_PERCENT;
  }

  const topPercent = Math.max(MIN_TOP_PERCENT, 100 - bestPercentile);

  return Math.round(topPercent * 10) / 10;
}

function calculateTopSongs(
  listenedSongs: ListenedSongStats[],
  albumMap: Map<string, IAlbum>
): WrappedSong[] {
  if (!Array.isArray(listenedSongs)) {
    console.error("listenedSongs is not an array in calculateTopSongs");
    return [];
  }
  return [...listenedSongs]
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, 5)
    .map((song) => {
      const albumIdStr = song.albumId?.toString();
      const album = albumIdStr ? albumMap.get(albumIdStr) : undefined;

      return {
        title: song.songTitle || "Titre Inconnu",
        artist: album?.artist?.join(" & ") || "Artiste Inconnu",
        playCount: song.playCount || 0,
      };
    });
}

function calculateTopAlbums(
  listenedAlbums: ListenedAlbumStats[],
  albumMap: Map<string, IAlbum>
): WrappedAlbum[] {
  if (!Array.isArray(listenedAlbums)) {
    console.error("listenedAlbums is not an array in calculateTopAlbums");
    return [];
  }
  return [...listenedAlbums]
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, 6)
    .map((listenedAlbum) => {
      const albumIdStr = listenedAlbum.albumId?.toString();
      const albumData = albumIdStr ? albumMap.get(albumIdStr) : undefined;

      const cdnUrl = process.env.CDN_URL || "";
      const coverPath = albumData?.cover || "";
      let formattedCover = "/assets/default-cover.jpg";

      if (coverPath) {
        if (coverPath.startsWith("http")) {
          formattedCover = coverPath;
        } else if (cdnUrl) {
          formattedCover = encodeURI(
            `${cdnUrl}/${
              coverPath.startsWith("/") ? coverPath.substring(1) : coverPath
            }`
          );
        }
      }

      return {
        title: albumData?.title || "Album Inconnu",
        artist: albumData?.artist || [],
        coverUrl: formattedCover,
        playCount: listenedAlbum.playCount || 0,
      };
    });
}

function calculateListeningTimes(listenedSongs: ListenedSongStats[]) {
  const times = {
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0,
  };

  if (!Array.isArray(listenedSongs)) {
    console.error("listenedSongs is not an array in calculateListeningTimes");
    return times;
  }

  listenedSongs.forEach((song) => {
    if (Array.isArray(song.listenHistory)) {
      song.listenHistory.forEach((date: Date | string) => {
        try {
          const validDate = new Date(date);
          if (!isNaN(validDate.getTime())) {
            const hour = validDate.getHours();
            if (hour >= 6 && hour < 12) times.morning++;
            else if (hour >= 12 && hour < 18) times.afternoon++;
            else if (hour >= 18 && hour < 24) times.evening++;
            else if (hour >= 0 && hour < 6) times.night++;
          } else {
            console.warn("Invalid date found in listenHistory:", date);
          }
        } catch (e) {
          console.error("Error processing date in listenHistory:", date, e);
        }
      });
    }
  });

  return times;
}

async function calculateListeningPercentiles(
  currentUser: IUser,
  albumMap: Map<string, IAlbum>
): Promise<PercentileResult[]> {
  try {
    const userStats = currentUser.listenedAlbums.map((album) => ({
      albumId: album.albumId.toString(),
      playCount: album.playCount,
    }));

    const allUsers = await UserModel.find(
      {},
      "_id listenedAlbums.albumId listenedAlbums.playCount"
    ).lean();

    const albumPlayCounts = new Map<string, number[]>();
    allUsers.forEach((user) => {
      user.listenedAlbums?.forEach((album) => {
        const albumIdStr = album.albumId.toString();
        if (!albumPlayCounts.has(albumIdStr)) {
          albumPlayCounts.set(albumIdStr, []);
        }
        if (typeof album.playCount === "number") {
          albumPlayCounts.get(albumIdStr)?.push(album.playCount);
        }
      });
    });

    const results: PercentileResult[] = [];
    userStats.forEach((userStat) => {
      const albumId = userStat.albumId;
      const userPlayCount = userStat.playCount;
      const allPlaysForAlbum = albumPlayCounts.get(albumId) || [];

      if (allPlaysForAlbum.length <= 1) {
        results.push({
          albumId,
          artist: albumMap.get(albumId)?.artist || [],
          percentile: 0,
          topPercent: MIN_TOP_PERCENT,
          totalListens: userPlayCount,
        });
        return;
      }

      const betterThanCount = allPlaysForAlbum.filter(
        (count) => count < userPlayCount
      ).length;
      const totalListeners = allPlaysForAlbum.length;

      const percentile =
        totalListeners > 0 ? (betterThanCount / totalListeners) * 100 : 0;

      const topPercent = Math.max(MIN_TOP_PERCENT, 100 - percentile);

      results.push({
        albumId,
        artist: albumMap.get(albumId)?.artist || [],
        percentile: percentile,
        topPercent: Math.round(topPercent * 10) / 10,
        totalListens: userPlayCount,
      });
    });

    return results;
  } catch (error) {
    console.error("Error calculating percentiles:", error);
    return [];
  }
}

function aggregateArtistStats(
  albumPercentiles: PercentileResult[]
): AggregatedArtistStat[] {
  const artistStatsMap = new Map<
    string,
    { totalListens: number; bestPercentile: number; albumIds: Set<string> }
  >();

  albumPercentiles.forEach((albumStat) => {
    const artists = albumStat.artist;
    if (!Array.isArray(artists)) return;

    artists.forEach((artistName) => {
      if (!artistStatsMap.has(artistName)) {
        artistStatsMap.set(artistName, {
          totalListens: 0,
          bestPercentile: 101,
          albumIds: new Set<string>(),
        });
      }

      const currentArtistStat = artistStatsMap.get(artistName)!;
      currentArtistStat.totalListens += albumStat.totalListens;
      currentArtistStat.bestPercentile = Math.min(
        currentArtistStat.bestPercentile,
        albumStat.percentile
      );
      currentArtistStat.albumIds.add(albumStat.albumId);
    });
  });

  const aggregatedStats: AggregatedArtistStat[] = [];
  artistStatsMap.forEach((stats, artistName) => {
    aggregatedStats.push({
      artistName,
      totalListens: stats.totalListens,
      bestPercentile: stats.bestPercentile > 100 ? 100 : stats.bestPercentile,
      albumIds: Array.from(stats.albumIds),
    });
  });

  return aggregatedStats;
}

function calculateLanguageBreakdown(
  listenedAlbums: ListenedAlbumStats[],
  albumMap: Map<string, IAlbum>
) {
  const langCounts: { [key: string]: number } = {};

  if (!Array.isArray(listenedAlbums)) {
    console.error(
      "listenedAlbums is not an array in calculateLanguageBreakdown"
    );
    return langCounts;
  }

  listenedAlbums.forEach((listenedAlbum) => {
    const albumIdStr = listenedAlbum.albumId?.toString();
    const albumData = albumIdStr ? albumMap.get(albumIdStr) : undefined;
    const albumLang = albumData?.lang;

    if (albumLang) {
      const playCount =
        typeof listenedAlbum.playCount === "number"
          ? listenedAlbum.playCount
          : 0;
      langCounts[albumLang] = (langCounts[albumLang] || 0) + playCount;
    }
  });

  return langCounts;
}

function handleApiError(ctx: Context, error: ApiError): void {
  ctx.status = error.status;
  ctx.body = { error: error.message, code: error.code };
}
