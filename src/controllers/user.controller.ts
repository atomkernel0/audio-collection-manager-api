/**
 * @file user.controller.ts
 * @description Controller handling HTTP requests for users.
 */

import { Context } from "koa";
import { logger } from "..";
import { UserService } from "../services/user.service";
import {
  changePasswordSchema,
  changeUsernameSchema,
  listenAlbumSchema,
  listenSongSchema,
  loginSchema,
  registerSchema,
} from "../dto/user.dto";
import { ApiError, ApiErrors } from "../interfaces/api-errors.interface";

/**
 * Centralized error handler for API errors.
 * @param {Context} ctx - Koa request/response context
 * @param {ApiError} apiError - Custom error object with status and code
 */
function handleApiError(ctx: Context, apiError: ApiError): void {
  ctx.status = apiError.status;
  ctx.body = { error: apiError.message, code: apiError.code };
}

/**
 * User controller, integrating the old userController methods
 * in a lighter version (since business logic is externalized in UserService).
 */
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Registers a new user if not authenticated, or returns an existing token if already logged in.
   * @param {Context} ctx - Koa request/response context
   */
  public async registerUser(ctx: Context): Promise<void> {
    try {
      const { error, value } = registerSchema.validate(ctx.request.body);
      if (error) {
        return handleApiError(ctx, {
          ...ApiErrors.INVALID_INPUT,
          message: error.details[0].message,
        });
      }
      const { username, password, hcaptchaResponse } = value;

      const result = await this.userService.registerUser(
        username,
        password,
        hcaptchaResponse,
        !!ctx["isUserAuthenticated"],
        ctx.headers.authorization
      );

      ctx.status = result.status;
      ctx.body = result.body;
      if (result.newAuthToken) {
        ctx.set("authorization", result.newAuthToken);
      }
      ctx["isUserAuthenticated"] = true;
    } catch (err: any) {
      logger.error("Error in registerUser:", err);
      handleApiError(
        ctx,
        err instanceof Object ? err : ApiErrors.INTERNAL_ERROR
      );
    }
  }

  /**
   * Logs in an existing user and generates a new JWT token.
   * @param {Context} ctx - Koa request/response context
   */
  public async loginUser(ctx: Context): Promise<void> {
    try {
      const { error, value } = loginSchema.validate(ctx.request.body);
      if (error) {
        return handleApiError(ctx, ApiErrors.INVALID_INPUT);
      }

      const { username, password } = value;
      const result = await this.userService.loginUser(username, password);

      ctx.status = result.status;
      ctx.body = result.body;
      if (result.newAuthToken) {
        ctx.set("authorization", result.newAuthToken);
      }
      ctx["isUserAuthenticated"] = true;
    } catch (err: any) {
      logger.error("Error in loginUser:", err);
      handleApiError(
        ctx,
        err instanceof Object ? err : ApiErrors.INTERNAL_ERROR
      );
    }
  }

  /**
   * Retrieves authenticated user information, with basic caching for performance.
   * @param {Context} ctx - Koa request/response context
   */
  public async getUserInfo(ctx: Context): Promise<void> {
    try {
      const token = ctx.request.headers.authorization?.split(" ")[1];
      if (!token) {
        return handleApiError(ctx, ApiErrors.UNAUTHORIZED);
      }

      const result = await this.userService.getUserInfo(token);
      ctx.status = result.status;
      ctx.body = result.body;
    } catch (err: any) {
      logger.error("Error in getUserInfo:", err);
      handleApiError(
        ctx,
        err instanceof Object ? err : ApiErrors.INTERNAL_ERROR
      );
    }
  }

  /**
   * Records a "listen" action for a specific song, updating user song and album statistics.
   * @param {Context} ctx - Koa request/response context
   */
  public async listenSong(ctx: Context): Promise<void> {
    try {
      const token = ctx.request.headers.authorization?.split(" ")[1];
      if (!token) {
        return handleApiError(ctx, ApiErrors.UNAUTHORIZED);
      }

      const { error, value } = listenSongSchema.validate(ctx.request.body);
      if (error) {
        return handleApiError(ctx, {
          ...ApiErrors.INVALID_INPUT,
          message: error.details[0].message,
        });
      }

      const { songTitle, songFile, albumId } = value;
      const result = await this.userService.listenSong(
        token,
        songTitle,
        songFile,
        albumId
      );
      ctx.status = result.status;
      ctx.body = result.body;
    } catch (err: any) {
      logger.error(`Error in listenSong: ${err}`);
      handleApiError(
        ctx,
        err instanceof Object ? err : ApiErrors.INTERNAL_ERROR
      );
    }
  }

  /**
   * Retrieves user listening statistics (songs and albums).
   * @param {Context} ctx - Koa request/response context
   */
  public async getUserListeningStats(ctx: Context): Promise<void> {
    try {
      const token = ctx.request.headers.authorization?.split(" ")[1];
      if (!token) {
        return handleApiError(ctx, ApiErrors.UNAUTHORIZED);
      }

      const result = await this.userService.getUserListeningStats(token);
      ctx.status = result.status;
      ctx.body = result.body;
    } catch (err: any) {
      logger.error("Error in getUserListeningStats:", err);
      handleApiError(
        ctx,
        err instanceof Object ? err : ApiErrors.INTERNAL_ERROR
      );
    }
  }

  /**
   * Retrieves the 30 most recently listened songs for the authenticated user.
   * @param {Context} ctx - Koa request/response context
   */
  public async getListenedSongs(ctx: Context): Promise<void> {
    try {
      const token = ctx.request.headers.authorization?.split(" ")[1];
      if (!token) {
        return handleApiError(ctx, ApiErrors.UNAUTHORIZED);
      }

      const result = await this.userService.getListenedSongs(token);
      ctx.status = result.status;
      ctx.body = result.body;
    } catch (err: any) {
      logger.error(`Error in getListenedSongs: ${err}`);
      handleApiError(
        ctx,
        err instanceof Object ? err : ApiErrors.INTERNAL_ERROR
      );
    }
  }

  /**
   * Records a "listen" action for an album.
   * @param {Context} ctx - Koa request/response context
   */
  public async listenAlbum(ctx: Context): Promise<void> {
    try {
      const token = ctx.request.headers.authorization?.split(" ")[1];
      if (!token) {
        return handleApiError(ctx, ApiErrors.UNAUTHORIZED);
      }

      const { error, value } = listenAlbumSchema.validate(ctx.request.body);
      if (error) {
        return handleApiError(ctx, {
          ...ApiErrors.INVALID_INPUT,
          message: error.details[0].message,
        });
      }

      const { albumId } = value;
      const result = await this.userService.listenAlbum(token, albumId);
      ctx.status = result.status;
      ctx.body = result.body;
    } catch (err: any) {
      logger.error("Error in listenAlbum:", err);
      handleApiError(
        ctx,
        err instanceof Object ? err : ApiErrors.INTERNAL_ERROR
      );
    }
  }

  /**
   * Retrieves the 15 most recently listened albums for the authenticated user.
   * @param {Context} ctx - Koa request/response context
   */
  public async getListenedAlbums(ctx: Context): Promise<void> {
    try {
      const token = ctx.request.headers.authorization?.split(" ")[1];
      if (!token) {
        return handleApiError(ctx, ApiErrors.UNAUTHORIZED);
      }

      const result = await this.userService.getListenedAlbums(token);
      ctx.status = result.status;
      ctx.body = result.body;
    } catch (err: any) {
      logger.error("Error in getListenedAlbums:", err);
      handleApiError(
        ctx,
        err instanceof Object ? err : ApiErrors.INTERNAL_ERROR
      );
    }
  }

  /**
   * Changes the username for the authenticated user.
   * @param {Context} ctx - Koa request/response context
   */
  public async changeUsername(ctx: Context): Promise<void> {
    try {
      const token = ctx.request.headers.authorization?.split(" ")[1];
      if (!token) {
        return handleApiError(ctx, ApiErrors.UNAUTHORIZED);
      }

      const { error, value } = changeUsernameSchema.validate(ctx.request.body);
      if (error) {
        return handleApiError(ctx, {
          ...ApiErrors.INVALID_INPUT,
          message: error.details[0].message,
        });
      }

      const { newUsername } = value;
      const result = await this.userService.changeUsername(token, newUsername);
      ctx.status = result.status;
      ctx.body = result.body;
    } catch (err: any) {
      logger.error("Error in changeUsername:", err);
      handleApiError(
        ctx,
        err instanceof Object ? err : ApiErrors.INTERNAL_ERROR
      );
    }
  }

  /**
   * Changes the password for the authenticated user.
   * @param {Context} ctx - Koa request/response context
   */
  public async changePassword(ctx: Context): Promise<void> {
    try {
      const token = ctx.request.headers.authorization?.split(" ")[1];
      if (!token) {
        return handleApiError(ctx, ApiErrors.UNAUTHORIZED);
      }

      const { error, value } = changePasswordSchema.validate(ctx.request.body);
      if (error) {
        return handleApiError(ctx, {
          ...ApiErrors.INVALID_INPUT,
          message: error.details[0].message,
        });
      }

      const { currentPassword, newPassword } = value;
      const result = await this.userService.changePassword(
        token,
        currentPassword,
        newPassword
      );
      ctx.status = result.status;
      ctx.body = result.body;
    } catch (err: any) {
      logger.error("Error in changePassword:", err);
      handleApiError(
        ctx,
        err instanceof Object ? err : ApiErrors.INTERNAL_ERROR
      );
    }
  }

  /**
   * Deletes the account (and all related data) of the authenticated user.
   * @param {Context} ctx - Koa request/response context
   */
  public async deleteAccount(ctx: Context): Promise<void> {
    try {
      const token = ctx.request.headers.authorization?.split(" ")[1];
      if (!token) {
        return handleApiError(ctx, ApiErrors.UNAUTHORIZED);
      }

      const result = await this.userService.deleteAccount(token);
      ctx.status = result.status;
      ctx.body = result.body;
    } catch (err: any) {
      logger.error("Error in deleteAccount:", err);
      handleApiError(
        ctx,
        err instanceof Object ? err : ApiErrors.INTERNAL_ERROR
      );
    }
  }

  /**
   * Adds a favorite album for the authenticated user.
   * @param {Context} ctx - Koa request/response context
   */
  public async addFavoriteAlbum(ctx: Context): Promise<void> {
    try {
      const token = ctx.request.headers.authorization?.split(" ")[1];
      if (!token) {
        return handleApiError(ctx, {
          ...ApiErrors.INVALID_CREDENTIALS,
          message: "No Token Provided.",
        });
      }

      const { albumId } = ctx.request.body as { albumId: string };
      const result = await this.userService.addFavoriteAlbum(token, albumId);
      ctx.status = result.status;
      ctx.body = result.body;
    } catch (err: any) {
      logger.error("Error adding album to favorites:", err);
      handleApiError(
        ctx,
        err instanceof Object ? err : ApiErrors.INTERNAL_ERROR
      );
    }
  }

  /**
   * Removes a favorite album for the authenticated user.
   * @param {Context} ctx - Koa request/response context
   */
  public async removeFavoriteAlbum(ctx: Context): Promise<void> {
    try {
      const token = ctx.request.headers.authorization?.split(" ")[1];
      if (!token) {
        return handleApiError(ctx, {
          ...ApiErrors.INVALID_CREDENTIALS,
          message: "No Token Provided.",
        });
      }

      const { albumId } = ctx.request.body as { albumId: string };
      const result = await this.userService.removeFavoriteAlbum(token, albumId);
      ctx.status = result.status;
      ctx.body = result.body;
    } catch (err: any) {
      logger.error("Error removing album from favorites:", err);
      handleApiError(
        ctx,
        err instanceof Object ? err : ApiErrors.INTERNAL_ERROR
      );
    }
  }

  /**
   * Retrieves all favorite albums for the authenticated user.
   * @param {Context} ctx - Koa request/response context
   */
  public async getFavoriteAlbums(ctx: Context): Promise<void> {
    try {
      const token = ctx.request.headers.authorization?.split(" ")[1];
      if (!token) {
        return handleApiError(ctx, {
          ...ApiErrors.INVALID_CREDENTIALS,
          message: "No Token Provided.",
        });
      }

      const result = await this.userService.getFavoriteAlbums(token);
      ctx.status = result.status;
      ctx.body = result.body;
    } catch (err: any) {
      logger.error("Error fetching favorite albums:", err);
      handleApiError(
        ctx,
        err instanceof Object ? err : ApiErrors.INTERNAL_ERROR
      );
    }
  }

  /**
   * Checks if a particular album is in the authenticated user's favorites.
   * @param {Context} ctx - Koa request/response context
   */
  public async checkIfAlbumIsFavorite(ctx: Context): Promise<void> {
    try {
      const token = ctx.request.headers.authorization?.split(" ")[1];
      if (!token) {
        return handleApiError(ctx, {
          ...ApiErrors.INVALID_CREDENTIALS,
          message: "No Token Provided.",
        });
      }

      const albumId = ctx.query.albumId;
      const result = await this.userService.checkIfAlbumIsFavorite(
        token,
        albumId
      );
      ctx.status = result.status;
      ctx.body = result.body;
    } catch (err: any) {
      logger.error("Error checking if album is favorite:", err);
      handleApiError(
        ctx,
        err instanceof Object ? err : ApiErrors.INTERNAL_ERROR
      );
    }
  }
}
