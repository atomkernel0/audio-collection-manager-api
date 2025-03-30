import { UserModel } from "../models/user.model";
import { AlbumModel } from "../models/album.model";
import {
  MusicGenre,
  IAlbum,
  ISongWithAlbumInfo,
} from "../interfaces/album.interface";
import {
  IUser,
  ListenedAlbumStats,
  ListenedSongStats,
} from "../interfaces/user.interface";
import { isValidObjectId } from "mongoose";
import { AlbumsFormatUtils, sanitize } from "@/utils";
import FavoriteAlbumModel from "@/models/favorite-album.model";
import { LRUCache } from "lru-cache";

interface RecommendationWeights {
  similarArtists: number;
  favoriteGenres: number;
  listenedAlbums: number;
  favoriteSongs: number;
  recency: number;
  popularity: number;
}

interface RecommendationResult {
  basedOnArtists: IAlbum[];
  basedOnGenres: IAlbum[];
  favoriteAlbums: IAlbum[];
  similarToLikedSongs: ISongWithAlbumInfo[];
  basedOnListenedAlbums?: IAlbum[];
}

// Time periods for recency calculations
const TIME_PERIODS = {
  RECENT: 7 * 24 * 60 * 60 * 1000,
  MEDIUM: 30 * 24 * 60 * 60 * 1000,
  OLD: 90 * 24 * 60 * 60 * 1000,
};

// Recency weights
const RECENCY_WEIGHTS = {
  RECENT: 1.0,
  MEDIUM: 0.6,
  OLD: 0.3,
  OLDER: 0.1,
};

/**
 * Service class for generating music recommendations based on user listening history,
 * favorite genres, artists, and songs.
 */
export class RecommendationsService {
  private recommendationsCache: LRUCache<string, any>;

  private userProfileCache: LRUCache<string, IUser>;

  constructor() {
    this.recommendationsCache = new LRUCache({
      max: 100,
      ttl: 24 * 60 * 60 * 1000,
      allowStale: false,
    });

    this.userProfileCache = new LRUCache({
      max: 100,
      ttl: 6 * 60 * 60 * 1000,
      allowStale: false,
    });
  }

  private readonly defaultWeights: RecommendationWeights = {
    similarArtists: 4,
    favoriteGenres: 5,
    listenedAlbums: 3,
    favoriteSongs: 2,
    recency: 1.5,
    popularity: 1,
  };

  /**
   * Generates personalized music recommendations for a given user.
   * It considers various factors like favorite artists, genres, listened albums,
   * and favorite songs, applying weights to each factor.
   *
   * @param {string} userId - The ID of the user for whom to generate recommendations.
   * @param {Partial<RecommendationWeights>} [weights] - Optional weights to customize the recommendation algorithm.
   * @param {boolean} [forceRefresh=false] - Force refresh recommendations instead of using cache.
   * @returns {Promise<RecommendationResult>} An object containing different categories of recommendations.
   * @throws {Error} If the user is not found or has no listening history.
   */
  public async generateRecommendations(
    userId: string,
    weights?: Partial<RecommendationWeights>,
    forceRefresh: boolean = false
  ): Promise<RecommendationResult> {
    const today = new Date().toISOString().split("T")[0];
    const cacheKey = `${userId}_${today}`;

    if (!forceRefresh && this.recommendationsCache.has(cacheKey)) {
      const cachedRecommendations = this.recommendationsCache.get(cacheKey);
      if (cachedRecommendations) {
        return cachedRecommendations as RecommendationResult;
      }
    }

    const finalWeights = { ...this.defaultWeights, ...weights };

    let user: IUser | undefined = this.userProfileCache.get(userId);

    if (!user) {
      user = await UserModel.findById(userId)
        .populate<{
          listenedAlbums: (ListenedAlbumStats & { albumId: IAlbum })[];
        }>({
          path: "listenedAlbums.albumId",
        })
        .populate<{
          listenedSongs: (ListenedSongStats & { albumId: IAlbum })[];
        }>({
          path: "listenedSongs.albumId",
        })
        .exec();

      if (user) {
        this.userProfileCache.set(userId, user);
      }
    }

    if (!user) {
      throw new Error("User not found");
    }

    if (user.listenedAlbums.length === 0 && user.listenedSongs.length === 0) {
      throw new Error("No listening history available for recommendations");
    }

    const [topSongs, favoriteGenres, favoriteArtists, favoriteAlbums] =
      await Promise.all([
        this.getTopListenedSongs(userId),
        this.calculateFavoriteGenres(user),
        this.calculateTopArtists(user),
        this.getFavoriteAlbums(userId),
      ]);

    const recencyWeightedUser = this.applyRecencyWeighting(
      user,
      finalWeights.recency
    );

    const [
      artistRecommendations,
      genreRecommendations,
      favoriteAlbumsFiltered,
      songRecommendations,
      listenedAlbumsRecommendations,
    ] = await Promise.all([
      this.getArtistBasedRecommendations(
        favoriteArtists,
        finalWeights.similarArtists,
        finalWeights.popularity
      ),
      this.getGenreBasedRecommendations(
        favoriteGenres,
        finalWeights.favoriteGenres,
        finalWeights.popularity
      ),
      this.filterAlreadyListened(favoriteAlbums, user),
      this.getSongBasedRecommendations(
        topSongs,
        finalWeights.favoriteSongs,
        finalWeights.popularity
      ),
      this.getListenedAlbumsRecommendations(
        recencyWeightedUser,
        finalWeights.listenedAlbums,
        finalWeights.popularity
      ),
    ]);

    const recommendations: RecommendationResult = {
      basedOnArtists: artistRecommendations,
      basedOnGenres: genreRecommendations,
      favoriteAlbums: favoriteAlbumsFiltered,
      similarToLikedSongs: songRecommendations,
      basedOnListenedAlbums: listenedAlbumsRecommendations,
    };

    const finalRecommendations = this.removeDuplicates(recommendations);
    this.recommendationsCache.set(cacheKey, finalRecommendations);

    return finalRecommendations;
  }

  /**
   * Applies recency weighting to a user's listening history to prioritize recent activity
   */
  private applyRecencyWeighting(user: IUser, recencyWeight: number): IUser {
    const now = new Date().getTime();

    const weightedUser = JSON.parse(JSON.stringify(user)) as IUser;

    weightedUser.listenedAlbums = user.listenedAlbums.map((album) => {
      const weightedAlbum = { ...album };

      if (album.listenHistory && album.listenHistory.length > 0) {
        const mostRecentListen = new Date(
          Math.max(
            ...album.listenHistory.map((date) => new Date(date).getTime())
          )
        ).getTime();

        const timeDiff = now - mostRecentListen;

        let recencyFactor = RECENCY_WEIGHTS.OLDER;
        if (timeDiff < TIME_PERIODS.RECENT) {
          recencyFactor = RECENCY_WEIGHTS.RECENT;
        } else if (timeDiff < TIME_PERIODS.MEDIUM) {
          recencyFactor = RECENCY_WEIGHTS.MEDIUM;
        } else if (timeDiff < TIME_PERIODS.OLD) {
          recencyFactor = RECENCY_WEIGHTS.OLD;
        }

        weightedAlbum.playCount = Math.ceil(
          album.playCount * recencyFactor * recencyWeight
        );
      }

      return weightedAlbum;
    });

    weightedUser.listenedSongs = user.listenedSongs.map((song) => {
      const weightedSong = { ...song };

      if (song.listenHistory && song.listenHistory.length > 0) {
        const mostRecentListen = new Date(
          Math.max(
            ...song.listenHistory.map((date) => new Date(date).getTime())
          )
        ).getTime();

        const timeDiff = now - mostRecentListen;

        let recencyFactor = RECENCY_WEIGHTS.OLDER;
        if (timeDiff < TIME_PERIODS.RECENT) {
          recencyFactor = RECENCY_WEIGHTS.RECENT;
        } else if (timeDiff < TIME_PERIODS.MEDIUM) {
          recencyFactor = RECENCY_WEIGHTS.MEDIUM;
        } else if (timeDiff < TIME_PERIODS.OLD) {
          recencyFactor = RECENCY_WEIGHTS.OLD;
        }

        weightedSong.playCount = Math.ceil(
          song.playCount * recencyFactor * recencyWeight
        );
      }

      return weightedSong;
    });

    return weightedUser;
  }

  /**
   * Retrieves the user's most listened-to songs, sorted by number of listens
   * with performance optimization
   */
  private async getTopListenedSongs(
    userId: string,
    limit = 20
  ): Promise<Array<{ songTitle: string; album: IAlbum }>> {
    const cacheKey = `topSongs_${userId}`;
    const cachedSongs = this.recommendationsCache.get(cacheKey);
    if (cachedSongs) {
      return cachedSongs as Array<{ songTitle: string; album: IAlbum }>;
    }

    const user = await UserModel.findById(userId)
      .populate<{
        listenedSongs: (ListenedSongStats & { albumId: IAlbum })[];
      }>({
        path: "listenedSongs.albumId",
        select: "_id title artist cover lang genre songs",
      })
      .select("listenedSongs")
      .lean()
      .exec();

    if (!user || !user.listenedSongs) return [];

    const result = user.listenedSongs
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, limit)
      .map((song) => ({
        songTitle: song.songTitle,
        album: song.albumId,
      }));

    this.recommendationsCache.set(cacheKey, result, {
      ttl: 2 * 60 * 60 * 1000,
    });

    return result;
  }

  /**
   * Calculates favorite genres based on history with performance optimization
   */
  private async calculateFavoriteGenres(user: IUser): Promise<MusicGenre[]> {
    const albumIds = user.listenedAlbums.map((la) => sanitize(la.albumId));

    const albums = await AlbumModel.find({
      _id: { $in: albumIds },
    })
      .select("genre")
      .lean<IAlbum[]>()
      .exec();

    const genreCounts = albums.reduce(
      (acc: Record<MusicGenre, number>, album) => {
        if (album?.genre) {
          const listenedAlbum = user.listenedAlbums.find(
            (la) => sanitize(la.albumId) === album._id
          );

          const playCount = listenedAlbum?.playCount || 1;

          album.genre.forEach((genre) => {
            acc[genre] = (acc[genre] || 0) + playCount;
          });
        }
        return acc;
      },
      {} as Record<MusicGenre, number>
    );

    return Object.entries(genreCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([genre]) => genre as MusicGenre)
      .slice(0, 3);
  }

  /**
   * Calculates the artists most listened to by the user, with performance optimization
   */
  private async calculateTopArtists(user: IUser): Promise<string[]> {
    const albumIds = user.listenedAlbums.map((la) => sanitize(la.albumId));

    const albums = await AlbumModel.find({
      _id: { $in: albumIds },
    })
      .select("artist")
      .lean<IAlbum[]>()
      .exec();

    const artistCounts = albums.reduce((acc: Record<string, number>, album) => {
      if (album?.artist) {
        const listenedAlbum = user.listenedAlbums.find(
          (la) => sanitize(la.albumId) === album._id
        );

        const playCount = listenedAlbum?.playCount || 1;

        album.artist.forEach((artist: string) => {
          acc[artist] = (acc[artist] || 0) + playCount;
        });
      }
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(artistCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([artist]) => artist)
      .slice(0, 5);
  }

  /**
   * Gets album popularity data for better recommendations
   */
  private async getAlbumPopularityData(): Promise<
    Array<{ albumId: string; playCount: number }>
  > {
    const cacheKey = "albumPopularityData";
    const cachedData = this.recommendationsCache.get(cacheKey);
    if (cachedData) {
      return cachedData as Array<{ albumId: string; playCount: number }>;
    }

    const popularityData = await UserModel.aggregate([
      { $unwind: "$listenedAlbums" },
      {
        $group: {
          _id: "$listenedAlbums.albumId",
          totalPlayCount: { $sum: "$listenedAlbums.playCount" },
        },
      },
      { $sort: { totalPlayCount: -1 } },
      {
        $project: {
          _id: 0,
          albumId: "$_id",
          playCount: "$totalPlayCount",
        },
      },
    ]).exec();

    this.recommendationsCache.set(cacheKey, popularityData, {
      ttl: 24 * 60 * 60 * 1000,
    });

    return popularityData;
  }

  /**
   * Returns albums based on the user's favorite artists
   * with optimized performance and popularity
   */
  private async getArtistBasedRecommendations(
    artists: string[],
    weight: number,
    popularityWeight: number
  ): Promise<IAlbum[]> {
    if (artists.length === 0) return [];

    const maxSize = Math.min(15, Math.floor(15 * weight));

    const cacheKey = `artistRecs_${artists.join(
      "_"
    )}_${weight}_${popularityWeight}`;
    const cachedRecs = this.recommendationsCache.get(cacheKey);
    if (cachedRecs) {
      return cachedRecs as IAlbum[];
    }

    const popularityData = await this.getAlbumPopularityData();

    const popularityMap = new Map<string, number>();
    popularityData.forEach((item) => {
      popularityMap.set(item.albumId, item.playCount);
    });

    const matchingAlbums = await AlbumModel.find({
      artist: { $in: artists },
    })
      .lean<IAlbum[]>()
      .exec();

    const maxPopularity =
      popularityData.length > 0 ? popularityData[0].playCount : 1;

    const scoredAlbums = matchingAlbums.map((album) => {
      const popularityScore = popularityMap.get(album._id) || 0;
      const randomFactor = Math.random();

      const score =
        randomFactor * (1.0 - popularityWeight) +
        (popularityScore / maxPopularity) * popularityWeight;

      return { album, score };
    });

    const selectedAlbums = scoredAlbums
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSize)
      .map((item) => item.album);

    const formattedAlbums = selectedAlbums.map((album) => {
      const formattedTitle = album.title
        .replace(/^[^-]+ - /, "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      const formattedCover = AlbumsFormatUtils.formatCoverUrl(album.cover);

      return {
        ...album,
        title: formattedTitle,
        cover: formattedCover,
        songLength: album.songs.length,
      } as IAlbum & { songLength: number };
    });

    this.recommendationsCache.set(cacheKey, formattedAlbums, {
      ttl: 6 * 60 * 60 * 1000,
    });

    return formattedAlbums;
  }

  /**
   * Returns albums based on the user's favorite genres
   * with optimized performance and popularity
   */
  private async getGenreBasedRecommendations(
    genres: MusicGenre[],
    weight: number,
    popularityWeight: number
  ): Promise<IAlbum[]> {
    if (genres.length === 0) return [];

    const maxSize = Math.min(6, Math.floor(6 * weight));

    const cacheKey = `genreRecs_${genres.join(
      "_"
    )}_${weight}_${popularityWeight}`;
    const cachedRecs = this.recommendationsCache.get(cacheKey);
    if (cachedRecs) {
      return cachedRecs as IAlbum[];
    }

    const popularityData = await this.getAlbumPopularityData();

    const popularityMap = new Map<string, number>();
    popularityData.forEach((item) => {
      popularityMap.set(item.albumId, item.playCount);
    });

    const matchingAlbums = await AlbumModel.find({
      genre: { $in: genres },
    })
      .lean<IAlbum[]>()
      .exec();

    const maxPopularity =
      popularityData.length > 0 ? popularityData[0].playCount : 1;

    const scoredAlbums = matchingAlbums.map((album) => {
      const popularityScore = popularityMap.get(album._id) || 0;
      const randomFactor = Math.random();

      const score =
        randomFactor * (1.0 - popularityWeight) +
        (popularityScore / maxPopularity) * popularityWeight;

      return { album, score };
    });

    const selectedAlbums = scoredAlbums
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSize)
      .map((item) => item.album);

    const formattedAlbums = selectedAlbums.map((album) => {
      const formattedTitle = album.title
        .replace(/^[^-]+ - /, "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      const formattedCover = AlbumsFormatUtils.formatCoverUrl(album.cover);

      return {
        ...album,
        title: formattedTitle,
        cover: formattedCover,
        songLength: album.songs.length,
      } as IAlbum & { songLength: number };
    });

    this.recommendationsCache.set(cacheKey, formattedAlbums, {
      ttl: 6 * 60 * 60 * 1000,
    });

    return formattedAlbums;
  }

  /**
   * Returns similar tracks (albums) to the most listened-to songs
   * with optimized performance and popularity
   */
  private async getSongBasedRecommendations(
    songs: Array<{ songTitle: string; album: IAlbum }>,
    weight: number,
    popularityWeight: number
  ): Promise<Array<ISongWithAlbumInfo>> {
    if (songs.length === 0) return [];
    const songTitles = songs.map((s) => s.songTitle);

    const cacheKey = `songRecs_${songTitles
      .join("_")
      .substring(0, 100)}_${weight}_${popularityWeight}`;
    const cachedRecs = this.recommendationsCache.get(cacheKey);
    if (cachedRecs) {
      return cachedRecs as Array<ISongWithAlbumInfo>;
    }

    const matchingAlbums = await AlbumModel.find({
      "songs.title": { $in: songTitles },
    })
      .lean<IAlbum[]>()
      .exec();

    const songMatches: ISongWithAlbumInfo[] = [];

    for (const album of matchingAlbums) {
      const matchingSongs = album.songs.filter((song) =>
        songTitles.includes(song.title)
      );

      for (const song of matchingSongs) {
        songMatches.push({
          title: song.title,
          file: song.file,
          albumTitle: album.title,
          albumArtist: album.artist,
          albumCover: album.cover,
          albumLang: album.lang,
          albumId: album._id,
        });
      }
    }

    const selectedSongs = songMatches
      .sort(() => Math.random() - 0.5 * (1 - popularityWeight))
      .slice(0, Math.floor(6 * weight));

    const formattedSongWithAlbumInfoArray = selectedSongs.map(
      (songWithAlbumInfo): ISongWithAlbumInfo => {
        const formattedAlbumTitle = songWithAlbumInfo.albumTitle
          .replace(/^[^-]+ - /, "")
          .trim()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");

        const formattedCover = AlbumsFormatUtils.formatCoverUrl(
          songWithAlbumInfo.albumCover
        );

        return {
          ...songWithAlbumInfo,
          albumTitle: formattedAlbumTitle,
          albumCover: formattedCover,
        };
      }
    );

    this.recommendationsCache.set(cacheKey, formattedSongWithAlbumInfoArray, {
      ttl: 6 * 60 * 60 * 1000,
    });

    return formattedSongWithAlbumInfoArray;
  }

  /**
   * Returns recommendations based on albums listened to by the user
   * with optimized performance and popularity
   */
  private async getListenedAlbumsRecommendations(
    user: IUser,
    weight: number,
    popularityWeight: number
  ): Promise<IAlbum[]> {
    if (!user.listenedAlbums.length) {
      return;
    }

    const maxSize = Math.min(8, Math.floor(8 * weight));

    const listenedAlbumIds = user.listenedAlbums.map((la) => la.albumId).sort();
    const cacheKey = `listenedRecs_${listenedAlbumIds
      .join("_")
      .substring(0, 100)}_${weight}_${popularityWeight}`;
    const cachedRecs = this.recommendationsCache.get(cacheKey);
    if (cachedRecs) {
      return cachedRecs as IAlbum[];
    }

    const albumIds = [...user.listenedAlbums]
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 8)
      .map((la) => la.albumId)
      .filter((id) => !isValidObjectId(id));

    const topAlbums = await AlbumModel.find({
      _id: { $in: albumIds },
    }).lean<IAlbum[]>();

    const artistsSet = new Set<string>();
    const genresSet = new Set<MusicGenre>();

    topAlbums.forEach((album) => {
      album.artist?.forEach((art) => artistsSet.add(art));
      album.genre?.forEach((g) => genresSet.add(g));
    });

    const popularityData = await this.getAlbumPopularityData();

    const popularityMap = new Map<string, number>();
    popularityData.forEach((item) => {
      popularityMap.set(item.albumId, item.playCount);
    });

    const matchingAlbums = await AlbumModel.find({
      $or: [
        { artist: { $in: Array.from(artistsSet) } },
        { genre: { $in: Array.from(genresSet) } },
      ],
      _id: { $nin: albumIds },
    }).lean<IAlbum[]>();

    const maxPopularity =
      popularityData.length > 0 ? popularityData[0].playCount : 1;

    const scoredAlbums = matchingAlbums.map((album) => {
      const popularityScore = popularityMap.get(album._id) || 0;
      const randomFactor = Math.random();

      const score =
        randomFactor * (1.0 - popularityWeight) +
        (popularityScore / maxPopularity) * popularityWeight;

      return { album, score };
    });

    const selectedAlbums = scoredAlbums
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSize)
      .map((item) => item.album);

    const formattedAlbums = selectedAlbums.map((album) => {
      const formattedTitle = album.title
        .replace(/^[^-]+ - /, "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      const formattedCover = AlbumsFormatUtils.formatCoverUrl(album.cover);

      return {
        ...album,
        title: formattedTitle,
        cover: formattedCover,
        songLength: album.songs.length,
      } as IAlbum & { songLength: number };
    });

    this.recommendationsCache.set(cacheKey, formattedAlbums, {
      ttl: 6 * 60 * 60 * 1000,
    });

    return formattedAlbums;
  }

  /**
   * Filters out albums already listened to by the user
   */
  private async filterAlreadyListened(
    recommendations: IAlbum[],
    user: IUser
  ): Promise<IAlbum[]> {
    if (recommendations.length === 0) return [];

    const listenedAlbumIds = new Set(
      user.listenedAlbums.map((item) => sanitize(item.albumId).toString())
    );

    const filteredAlbums = recommendations.filter(
      (album) => !listenedAlbumIds.has(album._id.toString())
    );

    if (filteredAlbums.length === 0 && recommendations.length > 0) {
      return recommendations.slice(0, 3);
    }

    return filteredAlbums;
  }

  /**
   * Removes duplicate albums and songs in all categories
   */
  private removeDuplicates(
    recommendations: RecommendationResult
  ): RecommendationResult {
    const seenAlbums = new Set<string>();
    const seenSongs = new Set<string>();

    const dedupeAlbums = <T extends { _id?: string; albumId?: string }>(
      arr: T[]
    ): T[] => {
      return arr.filter((item) => {
        const id = item._id?.toString() || item.albumId?.toString();
        if (!id || seenAlbums.has(id)) return false;
        seenAlbums.add(id);
        return true;
      });
    };

    const dedupeSongs = (arr: ISongWithAlbumInfo[]): ISongWithAlbumInfo[] => {
      return arr.filter((song) => {
        const key = `${song.title.toLowerCase().trim()}`;
        if (seenSongs.has(key)) return false;
        seenSongs.add(key);
        return true;
      });
    };

    return {
      basedOnArtists: dedupeAlbums(recommendations.basedOnArtists),
      basedOnGenres: dedupeAlbums(recommendations.basedOnGenres),
      favoriteAlbums: dedupeAlbums(recommendations.favoriteAlbums),
      similarToLikedSongs: dedupeSongs(recommendations.similarToLikedSongs),
      basedOnListenedAlbums: recommendations.basedOnListenedAlbums
        ? dedupeAlbums(recommendations.basedOnListenedAlbums)
        : undefined,
    };
  }

  /**
   * Retrieve favorite albums for recommendations
   */
  private async getFavoriteAlbums(userId: string): Promise<IAlbum[]> {
    const cacheKey = `favoriteAlbumsRecs_${userId}`;
    const cachedRecs = this.recommendationsCache.get(cacheKey);
    if (cachedRecs) {
      return cachedRecs as IAlbum[];
    }

    const favoriteAlbums = await FavoriteAlbumModel.find({ userId })
      .lean()
      .exec();

    const albumIds = favoriteAlbums.map((fav) => fav.albumId);

    if (albumIds.length === 0) {
      return [];
    }

    const favoriteAlbumsDetails = await AlbumModel.find({
      _id: { $in: albumIds },
    })
      .lean<IAlbum[]>()
      .exec();

    const favoriteArtists = new Set<string>();

    for (const album of favoriteAlbumsDetails) {
      if (album.artist) {
        for (const artist of album.artist) {
          favoriteArtists.add(artist);
        }
      }
    }

    if (favoriteArtists.size === 0) {
      return [];
    }

    const recommendedAlbums = await AlbumModel.aggregate([
      {
        $match: {
          artist: { $in: Array.from(favoriteArtists) },
          _id: { $nin: albumIds },
        },
      },
      { $sample: { size: 15 } },
      {
        $project: {
          title: 1,
          artist: 1,
          cover: 1,
          genre: 1,
          lang: 1,
          songLength: { $size: "$songs" },
        },
      },
    ]).exec();

    const formattedAlbums: IAlbum[] = recommendedAlbums.map((album) => {
      const formattedTitle = album.title
        .replace(/^[^-]+ - /, "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const formattedCover = AlbumsFormatUtils.formatCoverUrl(album.cover);
      return { ...album, title: formattedTitle, cover: formattedCover };
    });

    const sortedAlbums = formattedAlbums.sort((a, b) =>
      a.title.localeCompare(b.title)
    );

    this.recommendationsCache.set(cacheKey, sortedAlbums, {
      ttl: 6 * 60 * 60 * 1000,
    });

    return sortedAlbums;
  }
}
