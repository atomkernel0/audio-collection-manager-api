import { Context } from "koa";
import ListenedSongModel from "../models/listenedSongModel";
import { verifyToken } from "../utils";
import { AlbumModel } from "../models/album.model";

const MAX_SONGS_PER_ALBUM = 3;
const MAX_RECOMMENDED_ALBUMS = 10;
const MAX_RECOMMENDED_SONGS = 30;

const handleError = (ctx: Context, status: number, message: string) => {
  ctx.status = status;
  ctx.body = { error: message };
};

const validateToken = async (ctx: Context): Promise<string> => {
  const token = ctx.request.headers.authorization?.split(" ")[1];
  if (!token) {
    ctx.throw(401, "No token provided");
  }
  try {
    const decoded = verifyToken(token);
    if (!decoded.userId) {
      ctx.throw(400, "Missing userId");
    }
    return decoded.userId;
  } catch (err) {
    ctx.throw(401, "Invalid Token");
  }
};

export const getRecommendations = async (ctx: Context): Promise<void> => {
  try {
    const userId = await validateToken(ctx);

    const listenedSongs = await ListenedSongModel.find({ userId })
      .limit(100)
      .lean()
      .exec();

    if (listenedSongs.length === 0) {
      ctx.status = 200;
      ctx.body = { recommendations: [] };
      return;
    }

    const songTitles = listenedSongs.map((song) => song.songTitle);
    const albums = await AlbumModel.find({ "songs.title": { $in: songTitles } })
      .limit(50)
      .lean()
      .exec();

    const counts = albums.reduce(
      (acc, album) => {
        album.artist.forEach((artist) => {
          acc.artistCount[artist] = (acc.artistCount[artist] || 0) + 1;
        });
        acc.albumCount[album.title] = (acc.albumCount[album.title] || 0) + 1;
        album.songs.forEach((song) => {
          acc.songCount[song.title] = (acc.songCount[song.title] || 0) + 1;
        });
        return acc;
      },
      { artistCount: {}, albumCount: {}, songCount: {} } as Record<
        string,
        Record<string, number>
      >
    );

    const getFavorites = (count: Record<string, number>, limit: number) =>
      Object.entries(count)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([key]) => key);

    const favoriteArtists = getFavorites(counts.artistCount, 10);
    const favoriteAlbums = getFavorites(counts.albumCount, 10);
    const favoriteSongs = getFavorites(counts.songCount, 10);

    const recommendedAlbums = await AlbumModel.find({
      $or: [
        { artist: { $in: favoriteArtists } },
        { title: { $in: favoriteAlbums } },
        { "songs.title": { $in: favoriteSongs } },
      ],
    })
      .limit(MAX_RECOMMENDED_ALBUMS)
      .lean()
      .exec();

    const recommendedSongs = recommendedAlbums
      .flatMap((album) => album.songs.slice(0, MAX_SONGS_PER_ALBUM))
      .slice(0, MAX_RECOMMENDED_SONGS);

    ctx.status = 200;
    ctx.body = {
      recommendations: {
        albums: recommendedAlbums,
        songs: recommendedSongs,
      },
    };
  } catch (error) {
    console.error("An error occurred while getting recommendations:", error);
    handleError(ctx, 500, "Internal server error");
  }
};
