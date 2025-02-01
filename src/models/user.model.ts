/**
 * @file user.model.ts
 * @description Mongoose Schema for the User entity.
 */

import { Schema, model } from "mongoose";
import { IUser } from "../interfaces/user.interface";

/**
 * Sub-schema for listened songs
 */
const listenedSongStatsSchema = new Schema({
  songTitle: { type: String, required: true },
  songFile: { type: String, required: true },
  albumId: { type: String, required: true },
  playCount: { type: Number, default: 1 },
  listenHistory: [{ type: Date, default: Date.now }],
});

/**
 * Sub-schema for listened albums
 */
const listenedAlbumStatsSchema = new Schema({
  albumId: { type: String, required: true },
  playCount: { type: Number, default: 1 },
  listenHistory: [{ type: Date, default: Date.now }],
});

/**
 * Sub-schema for favorite playlist
 */
const favoritePlaylistSchema = new Schema({
  name: { type: String, default: "Favoris" },
  private: { type: Boolean, default: true },
  songs: [
    {
      title: String,
      file: String,
    },
  ],
});

/**
 * Main schema for user
 */
const userSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  playlists: [{ type: Schema.Types.ObjectId, ref: "Playlist" }],
  favoritePlaylist: favoritePlaylistSchema,
  listenedSongs: [listenedSongStatsSchema],
  listenedAlbums: [listenedAlbumStatsSchema],
});

export const UserModel = model<IUser>("User", userSchema);
