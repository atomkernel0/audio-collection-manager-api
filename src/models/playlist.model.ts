/**
 * @file playlist.model.ts
 * @description Mongoose Schema for the Playlist entity.
 */

import { Schema, model } from "mongoose";
import { IPlaylist } from "../interfaces/playlist.interface";

/**
 * Mongoose Schema for the Playlist collection.
 */
const playlistSchema = new Schema<IPlaylist>({
  name: { type: String, required: true },
  private: { type: Boolean, required: true },
  songs: [
    {
      _id: { type: String, required: false },
      title: { type: String, required: false },
      file: { type: String, required: false },
      albumTitle: { type: String, required: false },
      albumArtist: [{ type: String, required: false }],
      albumCover: { type: String, required: false },
      albumId: { type: String, required: false },
      albumLang: { type: String, required: false },
    },
  ],
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
});

export const PlaylistModel = model<IPlaylist>("Playlist", playlistSchema);
