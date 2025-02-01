/**
 * @file playlist.controller.ts
 * @description The controller handles HTTP requests related to playlists.
 * It delegates business logic to the PlaylistService.
 */

import { Context } from "koa";
import {
  songSchema,
  playlistSchema,
  playlistOrderSchema,
  togglePrivateSchema,
  playlistNameSchema,
} from "../dto/playlist.dto";
import { PlaylistService } from "../services/playlist.service";
import { logger } from "..";
import { sanitize, verifyToken } from "../utils";

/**
 * Centralized error handler for Koa context.
 * Logs the error using pino and sets the appropriate status and body.
 * @param {Context} ctx - The Koa context object.
 * @param {number} status - The HTTP status code.
 * @param {string} message - The error message to be returned.
 * @returns {void}
 */
const handleError = (ctx: Context, status: number, message: string): void => {
  logger.error(`Error [${status}]: ${message}`);
  ctx.status = status;
  ctx.body = { error: message };
};

/**
 * Helper function to validate and decode JWT token from Koa context headers.
 * Throws HTTP 401 if token is missing or invalid.
 * @param {Context} ctx - The Koa context object.
 * @returns {Promise<string>} The userId extracted from the token.
 */
const validateToken = async (ctx: Context): Promise<string> => {
  const token = ctx.request.headers.authorization?.split(" ")[1];
  if (!token) {
    handleError(ctx, 401, "No token provided");
    throw new Error("No token provided");
  }
  try {
    const decoded = verifyToken(token);
    return decoded.userId;
  } catch (err) {
    handleError(ctx, 401, "Invalid Token");
    throw new Error("Invalid token");
  }
};

/**
 * Controller class for managing playlist-related endpoints.
 * Constructs a PlaylistController instance with PlaylistService injection.
 */
export class PlaylistController {
  constructor(private readonly playlistService: PlaylistService) {}

  /**
   * Retrieves a playlist by ID (and caches it if public).
   */
  public async getPlaylist(ctx: Context): Promise<void> {
    try {
      const playlistId = ctx.params.playlistId as string;

      let userId: string | null = null;
      const headersAuthorization =
        ctx.request.headers.authorization?.split(" ")[1];
      if (headersAuthorization) {
        try {
          const decoded = verifyToken(headersAuthorization);
          userId = decoded.userId;
        } catch (error) {
          logger.error("Token validation error:", error);
        }
      }

      const result = await this.playlistService.getPlaylistById(
        playlistId,
        userId
      );
      if (!result) {
        handleError(ctx, 404, "Playlist not found");
        return;
      }

      ctx.status = 200;
      ctx.body = {
        ...result.playlist,
        isOwner: result.isOwner,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("permission")) {
        handleError(ctx, 403, error.message);
      } else if (
        error instanceof Error &&
        error.message.includes("Invalid Playlist ID")
      ) {
        handleError(ctx, 400, error.message);
      } else if (
        error instanceof Error &&
        error.message.includes("not found")
      ) {
        handleError(ctx, 404, error.message);
      } else {
        logger.error("Error in getPlaylist:", error);
        handleError(ctx, 500, "Internal Server Error");
      }
    }
  }
  /**
   * Retrieves all playlists for the authenticated user (with only a preview of 4 songs).
   */
  public async getUserPlaylists(ctx: Context): Promise<void> {
    try {
      const userId = await validateToken(ctx);
      const playlists = await this.playlistService.getUserPlaylists(userId);

      ctx.status = 200;
      ctx.body = playlists;
    } catch (error) {
      logger.error("Error in getUserPlaylists:", error);
      handleError(ctx, 500, "Internal Server Error");
    }
  }

  /**
   * Adds a song to a playlist or creates a playlist for the user if it doesn't exist.
   */
  public async addSongToPlaylist(ctx: Context): Promise<void> {
    try {
      const userId = await validateToken(ctx);

      const { error, value } = playlistSchema.validate(ctx.request.body);
      if (error) {
        handleError(ctx, 400, error.details[0].message);
        return;
      }

      const { name, private: isPrivate, song } = value;

      const result = await this.playlistService.addSongToPlaylist(
        userId,
        name,
        isPrivate,
        song
      );

      ctx.status = 200;
      ctx.body = result;
    } catch (error) {
      if (error instanceof Error && error.message.includes("User not found")) {
        handleError(ctx, 404, error.message);
      } else if (
        error instanceof Error &&
        error.message.includes("Song already exists")
      ) {
        handleError(ctx, 400, error.message);
      } else {
        logger.error("Error in addSongToPlaylist:", error);
        handleError(ctx, 500, "Internal Server Error");
      }
    }
  }

  /**
   * Toggles a song in user's "favoritePlaylist" (add/remove).
   */
  public async toggleSongInFavoritePlaylist(ctx: Context): Promise<void> {
    try {
      const userId = await validateToken(ctx);

      const { error, value } = songSchema.validate(ctx.request.body);
      if (error) {
        handleError(ctx, 400, error.details[0].message);
        return;
      }

      const { title, file } = value;
      const result = await this.playlistService.toggleSongInFavoritePlaylist(
        userId,
        {
          title,
          file,
        }
      );

      ctx.status = 200;
      ctx.body = result;
    } catch (error) {
      logger.error("Error in toggleSongInFavoritePlaylist:", error);
      handleError(ctx, 500, "Internal Server Error");
    }
  }
  /**
   * Checks if a song is in a user's favorite playlist.
   */
  public async isSongFavorite(ctx: Context): Promise<void> {
    try {
      const userId = await validateToken(ctx);

      const songTitle = sanitize(ctx.query.songTitle as string);
      if (!songTitle) {
        handleError(ctx, 400, "Song title is required");
        return;
      }

      const isFavorite = await this.playlistService.isSongFavorite(
        userId,
        songTitle
      );
      ctx.status = 200;
      ctx.body = { isFavorite };
    } catch (error) {
      logger.error("Error checking if song is favorite:", error);
      handleError(ctx, 500, "Internal Server Error");
    }
  }

  /**
   * Retrieves the user's favorite playlist.
   */
  public async getFavoritePlaylist(ctx: Context): Promise<void> {
    try {
      const userId = await validateToken(ctx);
      const favoritePlaylist = await this.playlistService.getFavoritePlaylist(
        userId
      );

      ctx.status = 200;
      ctx.body = favoritePlaylist;
    } catch (error) {
      logger.error("Error in getFavoritePlaylist:", error);
      handleError(ctx, 500, "Internal Server Error");
    }
  }

  /**
   * Edits a playlist name (owner only).
   */
  public async editPlaylistName(ctx: Context): Promise<void> {
    try {
      const userId = await validateToken(ctx);

      const playlistId = ctx.params.playlistId as string;
      const { newName } = ctx.request.body as { newName: string };

      const { error } = playlistNameSchema.validate({ playlistId, newName });
      if (error) {
        handleError(ctx, 400, error.details[0].message);
        return;
      }

      const updatedPlaylist = await this.playlistService.editPlaylistName(
        userId,
        playlistId,
        newName
      );

      ctx.status = 200;
      ctx.body = {
        message: "Playlist name updated successfully",
        playlist: updatedPlaylist,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        handleError(ctx, 404, error.message);
      } else if (
        error instanceof Error &&
        error.message.includes("permission")
      ) {
        handleError(ctx, 403, error.message);
      } else {
        logger.error("Error in editPlaylistName:", error);
        handleError(ctx, 500, "Internal Server Error");
      }
    }
  }

  /**
   * Toggles a playlist's private/public status (owner only).
   */
  public async togglePlaylistPrivacy(ctx: Context): Promise<void> {
    try {
      const userId = await validateToken(ctx);
      const playlistId = ctx.params.playlistId as string;

      const { error } = togglePrivateSchema.validate({ playlistId });
      if (error) {
        handleError(ctx, 400, error.details[0].message);
        return;
      }

      const updatedPlaylist = await this.playlistService.togglePlaylistPrivacy(
        userId,
        playlistId
      );

      ctx.status = 200;
      ctx.body = {
        message: `Playlist is now ${
          updatedPlaylist.private ? "private" : "public"
        }`,
        playlist: {
          _id: updatedPlaylist._id,
          name: updatedPlaylist.name,
          private: updatedPlaylist.private,
        },
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        handleError(ctx, 404, error.message);
      } else if (
        error instanceof Error &&
        error.message.includes("permission")
      ) {
        handleError(ctx, 403, error.message);
      } else {
        logger.error("Error in togglePlaylistPrivacy:", error);
        handleError(ctx, 500, "Internal Server Error");
      }
    }
  }

  /**
   * Deletes a playlist by ID (owner only).
   */
  public async deletePlaylist(ctx: Context): Promise<void> {
    try {
      const userId = await validateToken(ctx);
      const playlistId = ctx.params.playlistId as string;

      await this.playlistService.deletePlaylist(userId, playlistId);
      ctx.status = 200;
      ctx.body = { message: "Playlist deleted successfully" };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Invalid Playlist ID")
      ) {
        handleError(ctx, 400, error.message);
      } else if (
        error instanceof Error &&
        error.message.includes("not found")
      ) {
        handleError(ctx, 404, error.message);
      } else if (
        error instanceof Error &&
        error.message.includes("permission")
      ) {
        handleError(ctx, 403, error.message);
      } else {
        logger.error("Error in deletePlaylist:", error);
        handleError(ctx, 500, "Internal Server Error");
      }
    }
  }

  /**
   * Updates the order of songs in a playlist.
   */
  public async updatePlaylistOrder(ctx: Context): Promise<void> {
    try {
      const userId = await validateToken(ctx);

      const playlistId = ctx.params.playlistId as string;
      const { newOrder } = ctx.request.body as { newOrder: any[] };

      const { error } = playlistOrderSchema.validate({ playlistId, newOrder });
      if (error) {
        handleError(ctx, 400, error.details[0].message);
        return;
      }

      await this.playlistService.updatePlaylistOrder(
        userId,
        playlistId,
        newOrder
      );
      ctx.status = 200;
      ctx.body = { message: "Playlist order updated successfully" };
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        handleError(ctx, 404, error.message);
      } else if (
        error instanceof Error &&
        error.message.includes("permission")
      ) {
        handleError(ctx, 403, error.message);
      } else {
        logger.error("Error in updatePlaylistOrder:", error);
        handleError(ctx, 500, "Internal Server Error");
      }
    }
  }

  /**
   * Deletes a song from a playlist (owner only).
   */
  public async deleteSongFromPlaylist(ctx: Context): Promise<void> {
    try {
      const userId = await validateToken(ctx);

      const playlistId = ctx.params.playlistId as string;
      const songId = ctx.params.songId as string;

      await this.playlistService.deleteSongFromPlaylist(
        userId,
        playlistId,
        songId
      );

      ctx.status = 200;
      ctx.body = { message: "Song deleted successfully from the playlist" };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Invalid Playlist ID")
      ) {
        handleError(ctx, 400, error.message);
      } else if (
        error instanceof Error &&
        error.message.includes("not found")
      ) {
        handleError(ctx, 404, error.message);
      } else if (
        error instanceof Error &&
        error.message.includes("permission")
      ) {
        handleError(ctx, 403, error.message);
      } else {
        logger.error("Error in deleteSongFromPlaylist:", error);
        handleError(ctx, 500, "Internal Server Error");
      }
    }
  }
}
