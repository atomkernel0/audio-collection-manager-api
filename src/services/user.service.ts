/**
 * @file user.service.ts
 * @description Service containing business logic for the User entity.
 */

import bcrypt from "bcrypt";
import axios from "axios";
import { LRUCache } from "lru-cache";
import { logger } from "..";
import {
  AlbumsFormatUtils,
  checkUser,
  createToken,
  createUser,
  sanitize,
  verifyToken,
} from "../utils";
import ListenedAlbumModel from "../models/listened-album.model";
import { AlbumModel } from "../models/album.model";
import FavoriteAlbumModel from "../models/favorite-album.model";
import ListenedSongModel from "../models/listened-song.model";
import { UserModel } from "../models/user.model";
import { ApiErrors } from "../interfaces/api-errors.interface";

export class UserService {
  /**
   * Simple LRU cache for getUserInfo.
   */
  private userInfoCache: LRUCache<string, any>;

  constructor() {
    this.userInfoCache = new LRUCache<string, any>({
      max: 100,
      ttl: 5000 * 60,
    });
  }

  /**
   * Validates if a token is present and correct, returns userId
   * or throws an ApiError if missing/invalid.
   */
  public validateTokenOrThrow(token?: string): string {
    if (!token) {
      throw { ...ApiErrors.UNAUTHORIZED, message: "Invalid or missing token" };
    }
    const decoded = verifyToken(token);
    if (!decoded.userId) {
      throw ApiErrors.UNAUTHORIZED;
    }
    return decoded.userId;
  }

  /**
   * Handles user registration: captcha verification, DB creation, JWT token generation.
   */
  public async registerUser(
    username: string,
    password: string,
    hcaptchaResponse: string,
    isUserAuthenticated: boolean,
    existingAuthHeader?: string
  ) {
    // If already logged in, return directly
    if (isUserAuthenticated && existingAuthHeader) {
      return {
        status: 200,
        body: {
          message: "Login successful.",
          token: existingAuthHeader,
        },
      };
    }

    // Check if user already exists by username
    const existingUserByUsername = await checkUser({ username });
    if (existingUserByUsername.success) {
      throw ApiErrors.USERNAME_TAKEN;
    }

    // Captcha verification
    const secretKey = process.env.HCAPTCHA_TOKEN || "";
    const verifyUrl = "https://hcaptcha.com/siteverify";
    const params = new URLSearchParams();
    params.append("secret", secretKey);
    params.append("response", hcaptchaResponse);

    try {
      const captchaVerification = await axios.post(verifyUrl, params);
      if (!captchaVerification.data.success) {
        throw {
          ...ApiErrors.INVALID_INPUT,
          message: "Captcha verification failed",
        };
      }
    } catch (err) {
      logger.error("Error during captcha verification:", err);
      throw {
        ...ApiErrors.INTERNAL_ERROR,
        message: "Error during captcha verification",
      };
    }

    // User creation
    const user = await createUser({ username, password });
    if (!user.success) {
      throw ApiErrors.INTERNAL_ERROR;
    }

    const token = createToken(user.data._id.toString(), user.data.username);
    return {
      status: 201,
      body: {
        message: "User registered successfully",
        token,
      },
      newAuthToken: token,
    };
  }

  /**
   * Handles existing user login: retrieve user from DB, compare password, return JWT token.
   */
  public async loginUser(username: string, password: string) {
    const user = await checkUser({ username });
    if (!user || !user.data) {
      throw ApiErrors.INVALID_CREDENTIALS;
    }

    const isPasswordValid = await bcrypt.compare(password, user.data.password);
    if (!isPasswordValid) {
      throw ApiErrors.INVALID_CREDENTIALS;
    }

    const token = createToken(user.data._id.toString(), user.data.username);
    return {
      status: 200,
      body: {
        message: "Login successful.",
        user: { username: user.data.username },
        token,
      },
      newAuthToken: token,
    };
  }

  /**
   * Returns authenticated user information (with caching).
   */
  public async getUserInfo(token: string) {
    const decoded = verifyToken(token);
    const userId = decoded.userId;
    if (!userId) {
      throw ApiErrors.UNAUTHORIZED;
    }

    // Check cache
    const cachedUser = this.userInfoCache.get(userId);
    if (cachedUser) {
      return { status: 200, body: { user: cachedUser } };
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw ApiErrors.USER_NOT_FOUND;
    }

    const totalPlays = user.listenedSongs.reduce((total, song) => {
      return total + song.playCount;
    }, 0);

    const favoriteCount = user.favoritePlaylist?.songs?.length || 0;
    const createdAt = user._id.getTimestamp();

    const userPayload = {
      userId: user._id.toString(),
      username: user.username,
      createdAt,
      playlistsCount: user.playlists ? user.playlists.length : 0,
      hasFavoritePlaylist: !!user.favoritePlaylist,
      totalPlays,
      favoriteCount,
    };

    // Caching
    this.userInfoCache.set(userId, userPayload);

    return {
      status: 200,
      body: { user: userPayload },
    };
  }

  /**
   * Marks a song as "listened" by the user, updates listenedSongs and listenedAlbums.
   */
  public async listenSong(
    token: string,
    songTitle: string,
    songFile: string,
    albumId: string
  ) {
    const userId = this.validateTokenOrThrow(token);

    const user = await UserModel.findById(userId);
    if (!user) {
      throw ApiErrors.USER_NOT_FOUND;
    }

    // Update or create song stats
    const songStats = user.listenedSongs.find(
      (stats) => stats.songTitle === songTitle
    );
    if (songStats) {
      songStats.playCount += 1;
      songStats.listenHistory.push(new Date());
    } else {
      user.listenedSongs.push({
        songTitle,
        songFile,
        albumId,
        playCount: 1,
        listenHistory: [new Date()],
      });
    }

    // Update or create album stats
    const albumStats = user.listenedAlbums.find(
      (stats) => stats.albumId === albumId
    );
    if (albumStats) {
      albumStats.playCount += 1;
      albumStats.listenHistory.push(new Date());
    } else {
      user.listenedAlbums.push({
        albumId,
        playCount: 1,
        listenHistory: [new Date()],
      });
    }

    await user.save();
    return {
      status: 201,
      body: { message: "Song listened successfully" },
    };
  }

  /**
   * Returns global listening stats (songs + albums) for the authenticated user.
   */
  public async getUserListeningStats(token: string) {
    const userId = this.validateTokenOrThrow(token);

    const user = await UserModel.findById(userId)
      .populate("listenedAlbums.albumId")
      .select("listenedSongs listenedAlbums");

    if (!user) {
      throw ApiErrors.USER_NOT_FOUND;
    }

    return {
      status: 200,
      body: {
        listenedSongs: user.listenedSongs,
        listenedAlbums: user.listenedAlbums,
      },
    };
  }

  /**
   * Returns the last thirty songs listened to by the user, sorted by listen date (desc).
   */
  public async getListenedSongs(token: string) {
    const userId = this.validateTokenOrThrow(token);

    const user = await UserModel.findById(userId).exec();
    if (!user) {
      throw ApiErrors.USER_NOT_FOUND;
    }

    // Sort by last listen date
    const sortedSongs = user.listenedSongs.sort((a, b) => {
      const lastListenA = a.listenHistory[a.listenHistory.length - 1].getTime();
      const lastListenB = b.listenHistory[b.listenHistory.length - 1].getTime();
      return lastListenB - lastListenA;
    });

    const recentSongs = sortedSongs.slice(0, 30);

    // Get album info
    const songPromises = recentSongs.map(async (song) => {
      try {
        const album = await AlbumModel.findById(song.albumId).lean().exec();
        if (!album) {
          // Log a warning instead of throwing an error
          logger.warn(
            `Album not found for ID: ${song.albumId} while fetching listened songs for user ${userId}. Skipping this song.`
          );
          return null; // Indicate that this song should be skipped
        }

        return {
          title: song.songTitle,
          file: song.songFile,
          listenedAt: song.listenHistory[song.listenHistory.length - 1],
          playCount: song.playCount,
          listenHistory: song.listenHistory,
          albumTitle: album.title,
          albumArtist: album.artist,
          albumCover: AlbumsFormatUtils.formatCoverUrl(album.cover),
          albumLang: album.lang,
          albumId: album._id,
        };
      } catch (error) {
        logger.error(
          `Error fetching album details for song ${song.songTitle} (Album ID: ${song.albumId}) for user ${userId}:`,
          error
        );
        return null; // Skip song on error
      }
    });

    // Wait for all promises and filter out nulls (skipped songs)
    const transformedSongs = (await Promise.all(songPromises)).filter(
      (songInfo): songInfo is NonNullable<typeof songInfo> => songInfo !== null
    );

    return {
      status: 200,
      body: { listenedSongs: transformedSongs },
    };
  }

  /**
   * Marks an album as "listened" by the user, saving in listenedAlbumModel.
   */
  public async listenAlbum(token: string, albumId: string) {
    try {
      const userId = this.validateTokenOrThrow(token);

      const album = await AlbumModel.findById(albumId).lean().exec();
      if (!album) {
        throw {
          ...ApiErrors.NOT_FOUND,
          message: "Album not found",
        };
      }

      const existingListenedAlbum = await ListenedAlbumModel.findOne({
        userId,
        "album._id": albumId,
      }).exec();

      if (existingListenedAlbum) {
        existingListenedAlbum.listenedAt = new Date();
        await existingListenedAlbum.save();
      } else {
        const albumToSave = {
          ...album,
          _id: albumId,
        };

        const newListenedAlbum = new ListenedAlbumModel({
          userId,
          album: albumToSave,
          listenedAt: new Date(),
        });

        await newListenedAlbum.save();
      }

      return {
        status: 201,
        body: { message: "Album listened successfully" },
      };
    } catch (error) {
      logger.error(`Error in listenAlbum: ${JSON.stringify(error)}`);
      logger.error(error);
      throw {
        ...ApiErrors.INTERNAL_ERROR,
        message: "Error in listenAlbum",
      };
    }
  }

  /**
   * Gets the last 15 albums listened to by the user.
   */
  public async getListenedAlbums(token: string) {
    const userId = this.validateTokenOrThrow(token);

    const listenedAlbums = await ListenedAlbumModel.find({ userId })
      .sort({ listenedAt: -1 })
      .limit(15)
      .exec();

    if (!listenedAlbums || listenedAlbums.length === 0) {
      return { status: 200, body: { albums: [] } };
    }

    const formattedAlbums = listenedAlbums.map((listenedAlbum) => {
      const album: any = listenedAlbum.album;
      const formattedTitle = album.title
        .replace(/^[^-]+ - /, "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      const formattedCover = AlbumsFormatUtils.formatCoverUrl(album.cover);
      const coverAvif = AlbumsFormatUtils.generateCoverAvif(album.cover);

      return {
        _id: album._id,
        title: formattedTitle,
        artist: album.artist,
        cover: formattedCover,
        coverAvif,
        lang: album.lang,
        songLength: album.songs.length,
      };
    });

    return {
      status: 200,
      body: { albums: formattedAlbums },
    };
  }

  /**
   * Changes the username
   */
  public async changeUsername(token: string, newUsername: string) {
    const userId = this.validateTokenOrThrow(token);

    const existingUser = await UserModel.findOne({ username: newUsername });
    if (existingUser) {
      throw {
        ...ApiErrors.CONFLICT,
        message: "This username is already taken",
      };
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { username: newUsername },
      { new: true }
    );

    if (!updatedUser) {
      throw ApiErrors.USER_NOT_FOUND;
    }

    const newToken = createToken(userId, newUsername);

    return {
      status: 200,
      body: {
        message: "Username updated successfully",
        newUsername: updatedUser.username,
        token: newToken,
      },
    };
  }

  /**
   * Changes the password
   */
  public async changePassword(
    token: string,
    currentPassword: string,
    newPassword: string
  ) {
    const userId = this.validateTokenOrThrow(token);

    const user = await UserModel.findById(userId);
    if (!user) {
      throw ApiErrors.USER_NOT_FOUND;
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isPasswordValid) {
      throw {
        ...ApiErrors.INVALID_CREDENTIALS,
        message: "Current password is incorrect",
      };
    }

    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
    user.password = hashedNewPassword;
    await user.save();

    return {
      status: 200,
      body: {
        message: "Password updated successfully",
      },
    };
  }

  /**
   * Deletes the user account + all associated data
   */
  public async deleteAccount(token: string) {
    const userId = this.validateTokenOrThrow(token);

    await Promise.all([
      ListenedAlbumModel.deleteMany({ userId }),
      ListenedSongModel.deleteMany({ userId }),
    ]);

    const deletedUser = await UserModel.findByIdAndDelete(userId);
    if (!deletedUser) {
      throw ApiErrors.USER_NOT_FOUND;
    }

    return {
      status: 200,
      body: {
        message: "Account deleted successfully",
      },
    };
  }

  /**
   * Adds an album to favorites
   */
  public async addFavoriteAlbum(token: string, albumId: string) {
    const userId = this.validateTokenOrThrow(token);

    if (!albumId || typeof albumId !== "string" || albumId.trim() === "") {
      throw {
        ...ApiErrors.INVALID_INPUT,
        message: "Invalid Album ID",
      };
    }

    const albumExists = await AlbumModel.findOne({ _id: sanitize(albumId) });
    if (!albumExists) {
      throw {
        ...ApiErrors.NOT_FOUND,
        message: "Album Not Found",
      };
    }

    const existingFavorite = await FavoriteAlbumModel.findOne({
      userId,
      albumId,
    });
    if (existingFavorite) {
      throw {
        ...ApiErrors.CONFLICT,
        message: "Album is already in favorites",
      };
    }

    const favoriteAlbum = new FavoriteAlbumModel({ userId, albumId });
    await favoriteAlbum.save();

    return {
      status: 201,
      body: { message: "Album added to favorites" },
    };
  }

  /**
   * Removes an album from favorites
   */
  public async removeFavoriteAlbum(token: string, albumId: string) {
    const userId = this.validateTokenOrThrow(token);

    if (!albumId || typeof albumId !== "string" || albumId.trim() === "") {
      throw {
        ...ApiErrors.INVALID_INPUT,
        message: "Invalid Album ID",
      };
    }

    const result = await FavoriteAlbumModel.findOneAndDelete({
      userId,
      albumId,
    });
    if (!result) {
      throw {
        ...ApiErrors.NOT_FOUND,
        message: "Album Not Found in favorites",
      };
    }

    return {
      status: 200,
      body: { message: "Album removed from favorites" },
    };
  }

  /**
   * Gets all favorite albums for the user
   */
  public async getFavoriteAlbums(token: string) {
    const userId = this.validateTokenOrThrow(token);

    const favoriteAlbums = await FavoriteAlbumModel.find({ userId })
      .lean()
      .exec();
    const albumIds = favoriteAlbums.map((fav) => fav.albumId);

    if (albumIds.length === 0) {
      return { status: 200, body: { albums: [] } };
    }

    const unsortedAlbums = await AlbumModel.aggregate([
      { $match: { _id: { $in: albumIds } } },
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

      album.coverAvif = AlbumsFormatUtils.generateCoverAvif(album.cover);
      const formattedCover = AlbumsFormatUtils.formatCoverUrl(album.cover);

      return { ...album, title: formattedTitle, cover: formattedCover };
    });

    // Alphabetical sort
    const sortedAlbums = formattedAlbums.sort((a, b) =>
      a.title.localeCompare(b.title)
    );

    return {
      status: 200,
      body: { albums: sortedAlbums },
    };
  }

  /**
   * Checks if an album is in favorites
   */
  public async checkIfAlbumIsFavorite(
    token: string,
    albumId?: string | string[]
  ) {
    const userId = this.validateTokenOrThrow(token);

    if (!albumId) {
      throw {
        ...ApiErrors.INVALID_INPUT,
        message: "Album ID is required!",
      };
    }

    const singleAlbumId = Array.isArray(albumId) ? albumId[0] : albumId;
    if (typeof singleAlbumId !== "string" || singleAlbumId.trim() === "") {
      throw {
        ...ApiErrors.INVALID_INPUT,
        message: "Invalid Album ID",
      };
    }

    const favoriteAlbum = await FavoriteAlbumModel.findOne({
      userId,
      albumId: sanitize(singleAlbumId),
    });

    return {
      status: 200,
      body: { isFavorite: !!favoriteAlbum },
    };
  }
}
