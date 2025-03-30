import { model, Document, Schema } from "mongoose";

export interface FavoriteAlbum extends Document {
  userId: string;
  albumId: string;
}

const favoriteAlbumSchema = new Schema<FavoriteAlbum>({
  userId: { type: String, required: true },
  albumId: { type: String, required: true },
});

const FavoriteAlbumModel = model<FavoriteAlbum>(
  "FavoriteAlbum",
  favoriteAlbumSchema
);

export default FavoriteAlbumModel;
