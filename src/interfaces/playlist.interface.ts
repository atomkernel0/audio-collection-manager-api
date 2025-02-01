/**
 * @file playlist.interface.ts
 * @description Interface(s) related to the Playlist entity (strictly typed data).
 */

import { Document, Types } from "mongoose";

/**
 * Interface for the structure of a song in a playlist.
 */
export interface IPlaylistSong {
  _id?: string;
  title?: string;
  file?: string;
  albumTitle?: string;
  albumArtist?: string[];
  albumCover?: string;
  albumId?: string;
  albumLang?: string;
}

/**
 * Interface to represent a Playlist in the database.
 */
export interface IPlaylist extends Document {
  _id: string;
  name: string;
  private: boolean;
  songs: IPlaylistSong[];
  userId: Types.ObjectId;
}
