/**
 * @file album.model.ts
 * @description Mongoose Schema for the Album entity.
 */

import { Schema, model } from "mongoose";
import { IAlbum } from "../interfaces/album.interface";

/**
 * Mongoose Schema for the Album collection.
 */
const albumSchema = new Schema<IAlbum>({
  _id: { type: String, required: true },
  title: { type: String, required: true },
  artist: [{ type: String, required: true }],
  songs: [
    {
      title: { type: String, required: true },
      file: { type: String, required: true },
    },
  ],
  cover: { type: String, required: true },
  coverAvif: { type: String, required: true },
  lang: { type: String, required: true },
  genre: [{ type: String, required: true }],
});

export const AlbumModel = model<IAlbum>("Album", albumSchema);
