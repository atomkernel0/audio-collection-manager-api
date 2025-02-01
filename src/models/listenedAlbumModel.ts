import { Schema, model, Document } from "mongoose";

const songSchema = new Schema({
  title: String,
  file: String,
});

const albumSchema = new Schema({
  _id: String,
  title: String,
  artist: [String],
  songs: [songSchema],
  cover: String,
  lang: String,
});

export interface ListenedAlbum extends Document {
  userId: Schema.Types.ObjectId;
  album: typeof albumSchema;
  listenedAt: Date;
}

const listenedAlbumSchema = new Schema<ListenedAlbum>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  album: albumSchema,
  listenedAt: { type: Date, default: Date.now },
});

const ListenedAlbumModel = model<ListenedAlbum>(
  "ListenedAlbum",
  listenedAlbumSchema
);

export default ListenedAlbumModel;
