/**
 * @file album.interface.ts
 * @description Interface(s) related to the Album entity.
 */

import { Document } from "mongoose";

/**
 * Interface for the structure of a song in an album.
 */
export interface IAlbumSong {
  title: string;
  file: string;
}

/**
 * Interface for retrieving artist information with aggregated statistics.
 * Used for displaying artist overview data.
 */
export interface IGetArtists {
  name: string;
  totalSongs: number;
  totalAlbums: number;
  representativeCover: string;
}

/**
 * Enum representing the available music genres in the application
 * @enum {string}
 */
export enum MusicGenre {
  RAC = "RAC",
  NSBM = "NSBM",
  OI = "OI",
  RAP = "RAP",
  BALLADS = "BALLADS",
  CHANT_MILITAIRE = "CHANT_MILITAIRE",
  PSYCHEDELIC_ROCK = "PSYCHEDELIC_ROCK",
}

/**
 * Represents a song with its associated album information
 * Used for displaying song details along with its album context
 */
export interface ISongWithAlbumInfo {
  title: string;
  file: string;
  albumTitle: string;
  albumArtist: string[];
  albumCover: string;
  albumLang: string;
  albumId: string;
}

/**
 * Interface to represent an Album in the database.
 */
export interface IAlbum extends Document {
  _id: string;
  title: string;
  artist: string[];
  songs: IAlbumSong[];
  cover: string;
  coverAvif: string;
  lang: string;
  genre: MusicGenre[];
}
