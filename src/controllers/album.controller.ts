import { Context } from "koa";
import { logger } from "..";
import { AlbumService } from "../services/album.service";
import { sanitize } from "../utils";
import { MusicGenre } from "../interfaces/album.interface";

/**
 * Centralized error handler for Koa context.
 * @param {Context} ctx - The Koa context object.
 * @param {number} status - The HTTP status code for the error.
 * @param {string} message - The error message.
 * @returns {void}
 */
function handleError(ctx: Context, status: number, message: string): void {
  logger.error(`Error [${status}]: ${message}`);
  ctx.status = status;
  ctx.body = { error: message };
}

export class AlbumController {
  constructor(private readonly albumService: AlbumService) {}

  /**
   * Retrieves all albums (cached for 1 day by default).
   * @param {Context} ctx - The Koa context object.
   */
  public async getAlbums(ctx: Context): Promise<void> {
    try {
      const albums = await this.albumService.getAllAlbums();
      ctx.body = { albums };
      ctx.status = 200;
    } catch (error) {
      logger.error("Error fetching albums:", error);
      handleError(ctx, 500, "Internal Server Error");
    }
  }

  /**
   * Retrieves albums, sorted by normalized title, with pagination support.
   * @param {Context} ctx - The Koa context object.
   */
  public async getAlbumsByOrder(ctx: Context): Promise<void> {
    const page = Math.max(1, parseInt(ctx.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(ctx.query.limit as string) || 50)
    );

    try {
      const albums = await this.albumService.getAlbumsByOrder(page, limit);
      ctx.body = { albums };
      ctx.status = 200;
    } catch (error) {
      logger.error("Error fetching albums by order:", error);
      handleError(ctx, 500, "Internal Server Error");
    }
  }

  /**
   * Retrieves detailed info for a single album.
   * @param {Context} ctx - The Koa context object containing the albumId query parameter.
   */
  public async getAlbum(ctx: Context): Promise<void> {
    try {
      const albumId = ctx.query.albumId as string;
      if (!albumId || typeof albumId !== "string" || albumId.trim() === "") {
        handleError(ctx, 400, "Invalid Album ID");
        return;
      }

      const album = await this.albumService.getAlbumById(albumId);
      if (!album) {
        handleError(ctx, 404, "Album not found");
        return;
      }

      const transformedSongs = album.songs.map((song) => ({
        ...song,
        albumTitle: album.title,
        albumArtist: album.artist,
        albumCover: album.cover,
        albumLang: album.lang,
        albumId: album._id,
      }));

      ctx.body = {
        ...album,
        songs: transformedSongs,
      };
      ctx.status = 200;
    } catch (error) {
      logger.error("Error while fetching album by ID:", error);
      handleError(ctx, 500, "Internal Server Error");
    }
  }

  /**
   * Searches albums by title or artist using fuzzy matching.
   * @param {Context} ctx - The Koa context object containing query parameters.
   */
  public async searchAlbums(ctx: Context): Promise<void> {
    try {
      const searchTerm = (ctx.query.q as string) || "";
      const albums = await this.albumService.searchAlbums(searchTerm);

      ctx.status = 200;
      ctx.body = { albums };
    } catch (error) {
      logger.error("Error while searching albums:", error);
      handleError(ctx, 500, "Internal Server Error");
    }
  }

  /**
   * Retrieves a list of all artists along with total songs and albums.
   * @param {Context} ctx - The Koa context object.
   */
  public async getArtists(ctx: Context): Promise<void> {
    try {
      const artists = await this.albumService.getArtists();
      ctx.status = 200;
      ctx.body = { artists };
    } catch (error) {
      logger.error("Error while fetching artists:", error);
      handleError(ctx, 500, "Internal Server Error");
    }
  }

  /**
   * Retrieves the top 8 albums based on user listen count.
   * @param {Context} ctx - The Koa context object.
   */
  public async getMostListenedAlbums(ctx: Context): Promise<void> {
    try {
      const albums = await this.albumService.getMostListenedAlbums();
      if (albums.length === 0) {
        handleError(ctx, 404, "No albums found");
        return;
      }
      ctx.status = 200;
      ctx.body = { albums };
    } catch (error) {
      logger.error("Error while fetching most listened albums:", error);
      handleError(ctx, 500, "Internal Server Error");
    }
  }

  /**
   * Extracts the average color from a given cover image URL.
   * @param {Context} ctx - The Koa context object containing the coverURL query parameter.
   */
  public async getPrimaryColor(ctx: Context): Promise<void> {
    try {
      const coverURL = (ctx.query.coverURL as string) || "";
      if (!coverURL) {
        handleError(ctx, 400, "Invalid request: Please provide a coverURL");
        return;
      }

      const averageColor = await this.albumService.getPrimaryColor(coverURL);
      ctx.status = 200;
      ctx.body = { betterDominantColor: averageColor };
    } catch (error) {
      logger.error(
        "Error while fetching cover image or extracting color:",
        error
      );
      if (error instanceof Error && error.message.includes("Invalid URL")) {
        handleError(ctx, 400, error.message);
      } else {
        handleError(ctx, 500, "Internal Server Error");
      }
    }
  }

  /**
   * Returns 4 random albums from the database.
   * @param {Context} ctx - The Koa context object.
   */
  public async getRandomAlbums(ctx: Context): Promise<void> {
    try {
      const albums = await this.albumService.getRandomAlbums();
      ctx.body = { albums };
      ctx.status = 200;
    } catch (error) {
      logger.error("Error fetching random albums:", error);
      handleError(ctx, 500, "Internal Server Error");
    }
  }

  /**
   * Searches songs across all albums based on a search term.
   * @param {Context} ctx - The Koa context object containing the search query.
   */
  public async searchSongs(ctx: Context): Promise<void> {
    try {
      const searchTerm = (ctx.query.song as string) || "";
      const songs = await this.albumService.searchSongs(searchTerm);

      ctx.status = 200;
      ctx.body = { songs };
    } catch (error) {
      logger.error("Error while searching songs:", error);
      handleError(ctx, 500, "Internal Server Error");
    }
  }

  /**
   * Returns albums for a given artist, plus a random list of up to 6 songs and the total songs count.
   * @param {Context} ctx - The Koa context object containing the artist parameter.
   */
  public async getAlbumsByArtist(ctx: Context): Promise<void> {
    try {
      const artistName = sanitize(ctx.params.artist as string);
      if (!artistName || artistName.trim() === "") {
        ctx.status = 400;
        ctx.body = { error: "Invalid artist name" };
        return;
      }

      const { albums, randomSongs, totalSongs } =
        await this.albumService.getAlbumsByArtist(artistName);

      ctx.status = 200;
      ctx.body = {
        albums,
        artistRandomSongs: randomSongs,
        totalSongs,
      };
    } catch (error) {
      logger.error("Error fetching albums by artist:", error);
      handleError(ctx, 500, "Internal Server Error");
    }
  }

  /**
   * Returns albums for a specified genre, sorted by normalized title.
   * @param {Context} ctx - The Koa context object containing the genre query parameter.
   */
  public async getAlbumsByGenre(ctx: Context): Promise<void> {
    try {
      const genre = ctx.query.genre as MusicGenre;
      if (!genre || !Object.values(MusicGenre).includes(genre)) {
        handleError(ctx, 400, "Invalid genre parameter");
        return;
      }

      const albums = await this.albumService.getAlbumsByGenre(genre);
      ctx.body = { albums };
      ctx.status = 200;
    } catch (error) {
      logger.error("Error fetching albums by genre:", error);
      handleError(ctx, 500, "Internal Server Error");
    }
  }
}
