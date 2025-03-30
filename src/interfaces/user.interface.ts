/**
 * @file user.interface.ts
 * @description Interface(s) related to the User entity (strictly typed).
 */

import { Document, Types } from "mongoose";
import { IPlaylist, IPlaylistSong } from "./playlist.interface";

export interface ListenedSongStats {
  songTitle: string;
  songFile: string;
  albumId: string;
  playCount: number;
  listenHistory: Date[];
}

export interface ListenedAlbumStats {
  albumId: string;
  playCount: number;
  listenHistory: Date[];
}

/**
 * Interface representing the structure of a user.
 */
export interface IUser extends Document {
  _id: Types.ObjectId;
  username: string;
  password: string;
  playlists: IPlaylist[];
  favoritePlaylist: {
    name: "Favoris";
    private: true;
    songs: IPlaylistSong[];
  };
  listenedSongs: ListenedSongStats[];
  listenedAlbums: ListenedAlbumStats[];
}
