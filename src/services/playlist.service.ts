/**
 * @file playlist.service.ts
 * @description Service responsible for playlist business logic (DB access, cache, etc.).
 */

import NodeCache from "node-cache";
import { isValidObjectId } from "mongoose";
import { PlaylistModel } from "../models/playlist.model";
import { AlbumsFormatUtils } from "../utils";
import { logger } from "..";
import { IPlaylist, IPlaylistSong } from "../interfaces/playlist.interface";
import { AlbumModel } from "../models/album.model";
import { UserModel } from "../models/user.model";

/**
 * Main service for playlist management.
 * Handles data access layer and caching logic.
 */
export class PlaylistService {
  /**
   * In-memory cache for public playlists.
   * TTL = 5 minutes.
   */
  private readonly playlistCache = new NodeCache({ stdTTL: 300 });

  /**
   * Retrieves a playlist by its ID, with caching if the playlist is public.
   * @param playlistId The playlist ID.
   * @param requestingUserId The ID of the requesting user (or null if not authenticated).
   * @returns The found playlist (with transformations) or null if not existing.
   * @throws Error if user doesn't have access to a private playlist.
   */
  public async getPlaylistById(
    playlistId: string,
    requestingUserId: string | null
  ): Promise<{
    playlist: IPlaylist;
    isOwner: boolean;
  } | null> {
    if (!playlistId || !isValidObjectId(playlistId)) {
      throw new Error("Invalid Playlist ID");
    }

    // Check cache if playlist is known as public
    const cacheKey = `playlist_${playlistId}`;
    const cached = this.playlistCache.get(cacheKey);
    if (cached) {
      logger.info(`Serving playlist ${playlistId} from cache`);
      return cached as { playlist: IPlaylist; isOwner: boolean };
    }

    const playlist = await PlaylistModel.findOne({ _id: playlistId })
      .select("_id name private songs")
      .lean();

    if (!playlist) {
      return null;
    }

    // Find the owner user
    const user = await UserModel.findOne({ playlists: playlistId })
      .select("_id")
      .lean();

    if (!user) {
      throw new Error("Playlist owner not found");
    }

    // Check access if playlist is private
    const isOwner = requestingUserId === user._id.toString();
    if (playlist.private && !isOwner) {
      throw new Error(
        "You do not have permission to view this private playlist"
      );
    }

    // Transform songs to add album metadata
    const transformedSongs: IPlaylistSong[] = [];
    for (const song of playlist.songs || []) {
      const album = await AlbumModel.findOne({ "songs.title": song.title })
        .lean()
        .exec();
      if (album) {
        transformedSongs.push({
          ...song,
          albumTitle: album.title,
          albumArtist: album.artist,
          albumCover: AlbumsFormatUtils.formatCoverUrl(album.cover),
          albumLang: album.lang,
          albumId: album._id,
        });
      } else {
        transformedSongs.push(song);
      }
    }

    const fullPlaylist = {
      ...playlist,
      songs: transformedSongs,
    };

    // Cache if playlist is public
    if (!playlist.private) {
      this.playlistCache.set(cacheKey, { playlist: fullPlaylist, isOwner });
    }

    return {
      playlist: fullPlaylist as IPlaylist,
      isOwner,
    };
  }

  /**
   * Retrieves all playlists for a user.
   * @param userId The user ID.
   * @returns List of playlists with a preview of the first 4 songs.
   */
  public async getUserPlaylists(userId: string) {
    const user = await UserModel.findOne({ _id: userId }).lean();
    if (!user) {
      throw new Error("User not found");
    }

    const playlistIds = user.playlists;
    const playlists = await PlaylistModel.find({
      _id: { $in: playlistIds },
    }).lean();

    const transformedPlaylists = [];
    for (const playlist of playlists) {
      const firstFourSongs = playlist.songs.slice(0, 4);
      const transformedSongs: IPlaylistSong[] = [];

      for (const song of firstFourSongs) {
        const album = await AlbumModel.findOne({ "songs.title": song.title })
          .lean()
          .exec();
        if (album) {
          transformedSongs.push({
            title: song.title,
            file: song.file,
            albumTitle: album.title,
            albumArtist: album.artist,
            albumCover: AlbumsFormatUtils.formatCoverUrl(album.cover),
            albumLang: album.lang,
            albumId: album._id.toString(),
          });
        } else {
          transformedSongs.push({
            title: song.title,
            file: song.file,
          });
        }
      }

      transformedPlaylists.push({
        _id: playlist._id,
        name: playlist.name,
        private: playlist.private,
        songs: transformedSongs,
        songCount: playlist.songs.length,
      });
    }

    return transformedPlaylists;
  }

  /**
   * Adds a song to a playlist, or creates the playlist if it doesn't exist.
   * @param userId The user ID.
   * @param name Playlist name.
   * @param isPrivate Boolean indicating if the playlist is private.
   * @param song Object containing song information.
   * @returns The updated or created playlist.
   * @throws Error if song already exists in playlist.
   */
  public async addSongToPlaylist(
    userId: string,
    name: string,
    isPrivate: boolean,
    song: IPlaylistSong
  ) {
    const user = await UserModel.findOne({ _id: userId }).populate("playlists");

    if (!user) {
      throw new Error("User not found");
    }

    // Check if playlist already exists
    const existingPlaylist = user.playlists.find((p) => p.name === name);

    if (existingPlaylist) {
      // Check if song already exists
      const songExists = existingPlaylist.songs.some(
        (s) => s.title === song.title
      );
      if (songExists) {
        throw new Error("Song already exists in the playlist");
      }
      existingPlaylist.songs.push(song as any);
      await existingPlaylist.save();

      // Invalidate cache
      this.playlistCache.del(`playlist_${existingPlaylist._id}`);
      return {
        message: "Song added successfully",
        playlist: existingPlaylist,
      };
    } else {
      // Create new playlist
      const newPlaylist = new PlaylistModel({
        name,
        private: isPrivate,
        songs: [song],
        userId: user._id,
      });
      await newPlaylist.save();

      user.playlists.push(newPlaylist._id as any);
      await user.save();

      return {
        message: "Playlist created and song added successfully",
        playlist: newPlaylist,
      };
    }
  }

  /**
   * Toggles a song in user's "favorite" playlist (adds or removes).
   * @param userId The user ID.
   * @param song Object representing the song.
   * @returns An object indicating the favorite status of the song.
   */
  public async toggleSongInFavoritePlaylist(
    userId: string,
    song: IPlaylistSong
  ) {
    const user = await UserModel.findOne({ _id: userId });

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.favoritePlaylist) {
      user.favoritePlaylist = {
        name: "Favoris",
        private: true,
        songs: [],
      };
    }

    // Check if song is already in playlist
    const songIndex = user.favoritePlaylist.songs.findIndex(
      (s: any) => s.title === song.title && s.file === song.file
    );

    if (songIndex !== -1) {
      user.favoritePlaylist.songs.splice(songIndex, 1);
      await user.save();
      return {
        message: "Song removed from favorite playlist",
        song: { title: song.title, file: song.file },
        isFavorite: false,
      };
    } else {
      user.favoritePlaylist.songs.push({ title: song.title, file: song.file });
      await user.save();
      return {
        message: "Song added to favorite playlist",
        song: { title: song.title, file: song.file },
        isFavorite: true,
      };
    }
  }

  /**
   * Checks if a song is in a user's favorite playlist.
   * @param userId The user ID.
   * @param songTitle The song title.
   * @returns A boolean indicating if the song is favorite or not.
   */
  public async isSongFavorite(userId: string, songTitle: string) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (!user.favoritePlaylist) {
      return false;
    }

    return user.favoritePlaylist.songs.some((s: IPlaylistSong) => {
      return s.title === songTitle;
    });
  }

  /**
   * Retrieves the complete favorite playlist of a user.
   * @param userId The user ID.
   * @returns An object containing the favorite playlist and its transformed songs.
   */
  public async getFavoritePlaylist(userId: string) {
    const user = await UserModel.findById(userId).lean();
    if (!user) {
      throw new Error("User not found");
    }

    if (!user.favoritePlaylist) {
      return {
        favoritePlaylist: {
          name: "Favoris",
          private: true,
          songs: [],
        },
      };
    }

    // Transform each song to add album information
    const transformedSongs: IPlaylistSong[] = [];
    for (const song of user.favoritePlaylist.songs || []) {
      try {
        const album = await AlbumModel.findOne({ "songs.title": song.title })
          .lean()
          .exec();
        if (album) {
          transformedSongs.push({
            title: song.title,
            file: song.file,
            albumTitle: album.title,
            albumArtist: album.artist,
            albumCover: AlbumsFormatUtils.formatCoverUrl(album.cover),
            albumLang: album.lang,
            albumId: album._id.toString(),
          });
        } else {
          transformedSongs.push(song);
        }
      } catch (err) {
        logger.error(`Error transforming song ${song.title}:`, err);
        transformedSongs.push(song);
      }
    }

    return {
      favoritePlaylist: {
        name: "Favoris",
        private: true,
        songs: transformedSongs,
      },
    };
  }

  /**
   * Edits a playlist name (only if user is the owner).
   * @param userId The user ID.
   * @param playlistId The playlist ID.
   * @param newName The new playlist name.
   * @returns The updated playlist or throws an exception if not found or no rights.
   */
  public async editPlaylistName(
    userId: string,
    playlistId: string,
    newName: string
  ) {
    const playlist = await PlaylistModel.findOne({ _id: playlistId });
    if (!playlist) {
      throw new Error("Playlist not found");
    }

    const user = await UserModel.findOne({ _id: userId }).populate("playlists");
    if (!user) {
      throw new Error("User not found");
    }

    const isOwner = user.playlists.some(
      (p: IPlaylist) => p._id.toString() === playlistId
    );
    if (!isOwner) {
      throw new Error("You do not have permission to edit this playlist");
    }

    playlist.name = newName;
    await playlist.save();

    // Invalidate cache if playlist is public
    if (!playlist.private) {
      this.playlistCache.del(`playlist_${playlist._id}`);
    }

    return playlist;
  }

  /**
   * Toggles the 'private' property of a playlist.
   * @param userId The user ID.
   * @param playlistId The playlist ID.
   * @returns The updated playlist with its new private/public status.
   */
  public async togglePlaylistPrivacy(userId: string, playlistId: string) {
    const playlist = await PlaylistModel.findOne({ _id: playlistId });
    if (!playlist) {
      throw new Error("Playlist not found");
    }

    const user = await UserModel.findOne({ _id: userId }).populate("playlists");
    if (!user) {
      throw new Error("User not found");
    }

    const isOwner = user.playlists.some(
      (p: IPlaylist) => p._id.toString() === playlistId
    );
    if (!isOwner) {
      throw new Error("You do not have permission to modify this playlist");
    }

    playlist.private = !playlist.private;
    await playlist.save();

    // Invalidate cache
    this.playlistCache.del(`playlist_${playlist._id}`);

    return playlist;
  }

  /**
   * Deletes a playlist (only if user is the owner).
   * @param userId The user ID.
   * @param playlistId The playlist ID.
   */
  public async deletePlaylist(userId: string, playlistId: string) {
    if (!playlistId || !isValidObjectId(playlistId)) {
      throw new Error("Invalid Playlist ID");
    }

    const playlist = await PlaylistModel.findOne({ _id: playlistId });
    if (!playlist) {
      throw new Error("Playlist not found");
    }

    const user = await UserModel.findOne({ _id: userId }).populate("playlists");
    if (!user) {
      throw new Error("User not found");
    }

    const isOwner = user.playlists.some(
      (p: IPlaylist) => p._id.toString() === playlistId
    );
    if (!isOwner) {
      throw new Error("You do not have permission to delete this playlist");
    }

    await PlaylistModel.deleteOne({ _id: playlistId });

    // Remove playlist reference from user
    user.playlists = user.playlists.filter(
      (p: IPlaylist) => p._id.toString() !== playlistId
    ) as any;
    await user.save();

    // Remove from cache
    this.playlistCache.del(`playlist_${playlistId}`);
  }

  /**
   * Updates the order of songs in a playlist.
   * @param userId The user ID.
   * @param playlistId The playlist ID.
   * @param newOrder The new order (array of songs).
   */
  public async updatePlaylistOrder(
    userId: string,
    playlistId: string,
    newOrder: IPlaylistSong[]
  ) {
    const playlist = await PlaylistModel.findOne({ _id: playlistId });
    if (!playlist) {
      throw new Error("Playlist not found");
    }

    const user = await UserModel.findOne({ _id: userId });
    if (!user) {
      throw new Error("User not found");
    }

    const isOwner = user.playlists.some(
      (p: any) => p._id.toString() === playlistId
    );
    if (!isOwner) {
      throw new Error(
        "You do not have permission to change the order of this playlist"
      );
    }

    playlist.songs = newOrder;
    await playlist.save();

    this.playlistCache.del(`playlist_${playlist._id}`);
  }

  /**
   * Deletes a song from a playlist.
   * @param userId The user ID.
   * @param playlistId The playlist ID.
   * @param songId Title or unique identifier of the song to delete.
   */
  public async deleteSongFromPlaylist(
    userId: string,
    playlistId: string,
    songId: string
  ) {
    if (!playlistId || !isValidObjectId(playlistId) || !songId) {
      throw new Error("Invalid Playlist ID or Song Title");
    }

    const playlist = await PlaylistModel.findOne({ _id: playlistId });
    if (!playlist) {
      throw new Error("Playlist not found");
    }

    const user = await UserModel.findOne({ _id: userId });
    if (!user) {
      throw new Error("User not found");
    }

    const isOwner = user.playlists.some(
      (p: any) => p._id.toString() === playlistId
    );
    if (!isOwner) {
      throw new Error(
        "You do not have permission to delete a song in this playlist"
      );
    }

    // Find song index
    const songIndex = playlist.songs.findIndex((s) => s.title === songId);
    if (songIndex === -1) {
      throw new Error("Song not found in the playlist");
    }

    playlist.songs.splice(songIndex, 1);
    await playlist.save();

    this.playlistCache.del(`playlist_${playlist._id}`);
  }
}
