/**
 * @file album.service.ts
 * @description Service containing business logic for the Album entity.
 */

import Fuse from "fuse.js";
import NodeCache from "node-cache";
import { URL } from "url";
import { AlbumsFormatUtils, ImageColorUtils, sanitize } from "../utils";
import {
  IAlbum,
  IGetArtists,
  ISongWithAlbumInfo,
  MusicGenre,
} from "../interfaces/album.interface";
import { AlbumModel } from "../models/album.model";

/**
 * Service responsible for album management.
 * @description Service handling album operations including database access, caching, and data transformations.
 */
export class AlbumService {
  private readonly mostListenedAlbumsCache: NodeCache;
  private readonly getAlbumsCache: NodeCache;

  constructor() {
    this.mostListenedAlbumsCache = new NodeCache({ stdTTL: 604800 }); // 1 week
    this.getAlbumsCache = new NodeCache({ stdTTL: 86400 }); // 1 day
  }

  /**
   * Retrieves all albums (with 1-day caching).
   * @returns {Promise<IAlbum[]>} List of albums.
   */
  public async getAllAlbums(): Promise<IAlbum[]> {
    const cachedResult = this.getAlbumsCache.get<IAlbum[]>("all_albums");
    if (cachedResult) {
      return cachedResult;
    }

    const albums: IAlbum[] = await AlbumModel.aggregate([
      {
        $project: {
          title: 1,
          artist: 1,
          cover: 1,
          coverAvif: 1,
          lang: 1,
          songLength: { $size: "$songs" },
        },
      },
    ]);

    const formattedAlbums = albums.map((album) => {
      const formattedCover = AlbumsFormatUtils.formatCoverUrl(album.cover);
      const coverAvif = AlbumsFormatUtils.generateCoverAvif(formattedCover);

      return {
        ...album,
        cover: formattedCover,
        coverAvif,
      };
    });

    this.getAlbumsCache.set("all_albums", formattedAlbums);
    return formattedAlbums as IAlbum[];
  }

  /**
   * Retrieves albums, sorted by normalized title, with pagination.
   * @param page Page number
   * @param limit Number of albums per page
   * @returns {Promise<IAlbum[]>} Sorted and paginated list
   */
  public async getAlbumsByOrder(
    page: number,
    limit: number
  ): Promise<IAlbum[]> {
    // Get all unsorted albums
    const unsortedAlbums: IAlbum[] = await AlbumModel.aggregate([
      {
        $project: {
          title: 1,
          artist: 1,
          cover: 1,
          coverAvif: 1,
          lang: 1,
          songLength: { $size: "$songs" },
        },
      },
    ]);

    // Format title and cover
    const formattedAlbums = unsortedAlbums.map((album) => {
      const formattedTitle = album.title
        .replace(/^[^-]+ - /, "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      const formattedCover = AlbumsFormatUtils.formatCoverUrl(album.cover);
      album.coverAvif = AlbumsFormatUtils.generateCoverAvif(formattedCover);

      return {
        ...album,
        title: formattedTitle,
        cover: formattedCover,
      };
    });

    // Alphabetical sort by title
    const sortedAlbums = formattedAlbums.sort((a, b) =>
      a.title.localeCompare(b.title)
    );

    // Pagination
    const skip = (page - 1) * limit;
    const paginatedAlbums = sortedAlbums.slice(skip, skip + limit);

    return paginatedAlbums as IAlbum[];
  }

  /**
   * Returns complete album information (including song list).
   * @param albumId Album ID
   * @returns {Promise<IAlbum | null>}
   */
  public async getAlbumById(albumId: string): Promise<IAlbum | null> {
    const album = await AlbumModel.findOne({ _id: sanitize(albumId) })
      .lean<IAlbum>()
      .exec();

    if (!album) {
      return null;
    }

    album.cover = AlbumsFormatUtils.formatCoverUrl(album.cover);
    album.coverAvif = AlbumsFormatUtils.generateCoverAvif(album.cover);

    return album;
  }

  /**
   * Performs a fuzzy search (Fuse.js) on album titles and artists.
   * @param searchTerm Search term
   * @returns {Promise<IAlbum[]>} List of matching albums
   */
  public async searchAlbums(searchTerm: string): Promise<IAlbum[]> {
    const unsortedAlbums: IAlbum[] = await AlbumModel.aggregate([
      {
        $project: {
          title: 1,
          artist: 1,
          cover: 1,
          lang: 1,
          songLength: { $size: "$songs" },
        },
      },
    ]);

    const formattedAlbums = unsortedAlbums.map((album) => {
      const formattedTitle = album.title
        .replace(/^[^-]+ - /, "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      const formattedCover = AlbumsFormatUtils.formatCoverUrl(album.cover);
      album.coverAvif = AlbumsFormatUtils.generateCoverAvif(formattedCover);

      return {
        ...album,
        title: formattedTitle,
        cover: formattedCover,
      };
    });

    const fuse = new Fuse(formattedAlbums, {
      keys: ["title", "artist"],
      threshold: 0.3,
      includeScore: true,
    });

    const fuseResults = fuse.search(searchTerm);
    const sortedAlbums = fuseResults.map((result) => result.item);
    return sortedAlbums as IAlbum[];
  }

  /**
   * Retrieves the list of all artists along with their total songs and albums.
   * @returns {Promise<IGetArtists[]>} Array of artist objects
   */
  public async getArtists(): Promise<IGetArtists[]> {
    const artistsMap = new Map<string, IGetArtists>();
    const albums = await AlbumModel.find().lean().exec();

    for (const album of albums) {
      for (const artist of album.artist) {
        if (!artistsMap.has(artist)) {
          artistsMap.set(artist, {
            name: artist,
            totalSongs: 0,
            totalAlbums: 0,
            representativeCover: AlbumsFormatUtils.formatCoverUrl(album.cover),
          });
        }
        const artistInfo = artistsMap.get(artist)!;
        artistInfo.totalSongs += album.songs.length;
        artistInfo.totalAlbums += 1;
      }
    }

    const artistsArray = Array.from(artistsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    return artistsArray;
  }

  /**
   * Retrieves the 8 most listened albums (via listenedAlbums).
   * @returns {Promise<IAlbum[]>} Array of albums
   */
  public async getMostListenedAlbums(): Promise<IAlbum[]> {
    const cachedAlbums =
      this.mostListenedAlbumsCache.get<IAlbum[]>("mostListenedAlbums");
    if (cachedAlbums) {
      return cachedAlbums;
    }

    const mostListened: IAlbum[] = await AlbumModel.aggregate([
      {
        $lookup: {
          from: "listenedalbums",
          localField: "_id",
          foreignField: "album._id",
          as: "listened",
        },
      },
      {
        $addFields: {
          listenCount: { $size: "$listened" },
          songLength: { $size: "$songs" },
        },
      },
      { $sort: { listenCount: -1 } },
      { $limit: 8 },
      {
        $project: {
          _id: 1,
          title: 1,
          artist: 1,
          cover: 1,
          lang: 1,
          songLength: 1,
          listenCount: 1,
        },
      },
    ]);

    if (!mostListened || mostListened.length === 0) {
      return [];
    }

    const formattedAlbums = mostListened.map((album) => {
      const formattedTitle = album.title
        .replace(/^[^-]+ - /, "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      const formattedCover = AlbumsFormatUtils.formatCoverUrl(album.cover);
      album.coverAvif = AlbumsFormatUtils.generateCoverAvif(formattedCover);
      return { ...album, title: formattedTitle, cover: formattedCover };
    });

    this.mostListenedAlbumsCache.set("mostListenedAlbums", formattedAlbums);
    return formattedAlbums as IAlbum[];
  }

  /**
   * Extracts the average color from a cover (HTTP fetch + fast-average-color).
   * @param coverURL Cover URL
   * @returns {Promise<string>} Hex color
   */
  public async getPrimaryColor(coverURL: string): Promise<string> {
    const url = new URL(coverURL);
    if (!url.hostname.endsWith(process.env.CDN_URL)) {
      throw new Error(
        `Invalid URL: Only images from ${process.env.CDN_URL} are allowed`
      );
    }

    const averageColor = await ImageColorUtils.getAverageColorHex(
      AlbumsFormatUtils.formatCoverUrl(coverURL)
    );
    return averageColor;
  }

  /**
   * Retrieves 4 random albums.
   * @returns {Promise<Album[]>} Randomly selected albums
   */
  public async getRandomAlbums(): Promise<IAlbum[]> {
    const randomAlbums: IAlbum[] = await AlbumModel.aggregate([
      { $sample: { size: 4 } },
      {
        $project: {
          title: 1,
          artist: 1,
          cover: 1,
          lang: 1,
          songLength: { $size: "$songs" },
        },
      },
    ]);

    const formatted = randomAlbums.map((album) => {
      const formattedTitle = album.title
        .replace(/^[^-]+ - /, "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      const formattedCover = AlbumsFormatUtils.formatCoverUrl(album.cover);
      album.coverAvif = AlbumsFormatUtils.generateCoverAvif(formattedCover);

      return {
        ...album,
        title: formattedTitle,
        cover: formattedCover,
      };
    });
    return formatted as IAlbum[];
  }

  /**
   * Searches for songs across all albums based on a term.
   * @param searchTerm Song title to search for
   * @returns {Promise<ISongWithAlbumInfo[]>} List of matching songs
   */
  public async searchSongs(searchTerm: string): Promise<ISongWithAlbumInfo[]> {
    const albums = await AlbumModel.find({
      "songs.title": { $regex: sanitize(searchTerm), $options: "i" },
    })
      .lean()
      .exec();

    const matchingSongs: ISongWithAlbumInfo[] = [];
    for (const album of albums) {
      for (const song of album.songs) {
        if (song.title.toLowerCase().includes(searchTerm.toLowerCase())) {
          matchingSongs.push({
            ...song,
            albumTitle: album.title,
            albumArtist: album.artist,
            albumCover: AlbumsFormatUtils.formatCoverUrl(album.cover),
            albumLang: album.lang,
            albumId: album._id,
          });
        }
      }
    }
    return matchingSongs;
  }

  /**
   * Returns the list of albums for a given artist,
   * along with a random list of up to 6 songs and the total number of songs.
   * @param artistName Artist name
   * @returns {Promise<{albums: Partial<IAlbum>[]; randomSongs: ISongWithAlbumInfo[]; totalSongs: number}>}
   */
  public async getAlbumsByArtist(artistName: string): Promise<{
    albums: Partial<IAlbum>[];
    randomSongs: ISongWithAlbumInfo[];
    totalSongs: number;
  }> {
    const limit = 50;
    const lowercaseArtistName = artistName.toLowerCase();

    const albums = await AlbumModel.find({
      artist: {
        $elemMatch: { $regex: `^${lowercaseArtistName}$`, $options: "i" },
      },
    })
      .select("_id title artist cover lang songs")
      .limit(limit)
      .lean()
      .exec();

    const allArtistAlbums = await AlbumModel.find({
      artist: {
        $elemMatch: { $regex: `^${lowercaseArtistName}$`, $options: "i" },
      },
    })
      .select("_id title artist cover lang songs")
      .lean()
      .exec();

    const totalSongs = allArtistAlbums.reduce(
      (total, album) => total + album.songs.length,
      0
    );

    // Gather all songs from all albums by the artist
    const allSongsWithAlbumInfo: ISongWithAlbumInfo[] = allArtistAlbums.flatMap(
      (album) =>
        album.songs.map((song) => ({
          ...song,
          albumTitle: album.title,
          albumArtist: album.artist,
          albumCover: AlbumsFormatUtils.formatCoverUrl(album.cover),
          albumLang: album.lang,
          albumId: album._id,
        }))
    );

    // Pick up to 6 random songs
    const randomSongs: ISongWithAlbumInfo[] = [];
    const songCount = Math.min(6, allSongsWithAlbumInfo.length);
    const usedIndexes = new Set<number>();
    while (randomSongs.length < songCount) {
      const randomIndex = Math.floor(
        Math.random() * allSongsWithAlbumInfo.length
      );
      if (!usedIndexes.has(randomIndex)) {
        usedIndexes.add(randomIndex);
        randomSongs.push({ ...allSongsWithAlbumInfo[randomIndex] });
      }
    }

    // Title formatting
    const formattedPartialAlbums = albums.map((album) => ({
      _id: album._id,
      title: album.title
        .replace(/^[^-]+ - /, "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""),
      artist: album.artist,
      cover: AlbumsFormatUtils.formatCoverUrl(album.cover),
      lang: album.lang,
      songLength: album.songs.length,
    })) as Partial<IAlbum>[];

    return {
      albums: formattedPartialAlbums,
      randomSongs,
      totalSongs,
    };
  }

  /**
   * Returns albums of a given genre.
   * @param genre MusicGenre
   * @returns {Promise<IAlbum[]>} Albums of the genre
   */
  public async getAlbumsByGenre(genre: MusicGenre): Promise<IAlbum[]> {
    const unsortedAlbums: IAlbum[] = await AlbumModel.aggregate([
      { $match: { genre } },
      {
        $project: {
          title: 1,
          artist: 1,
          cover: 1,
          lang: 1,
          genre: 1,
          songLength: { $size: "$songs" },
        },
      },
    ]);

    const formattedAlbums = unsortedAlbums.map((album) => {
      const formattedTitle = album.title
        .replace(/^[^-]+ - /, "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      const formattedCover = AlbumsFormatUtils.formatCoverUrl(album.cover);
      album.coverAvif = AlbumsFormatUtils.generateCoverAvif(formattedCover);

      return { ...album, title: formattedTitle, cover: formattedCover };
    });

    const sortedAlbums = formattedAlbums.sort((a, b) =>
      a.title.localeCompare(b.title)
    );
    return sortedAlbums as IAlbum[];
  }
}
