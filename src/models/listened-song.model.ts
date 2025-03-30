import { Schema, Document, model } from 'mongoose';

interface ListenedSong extends Document {
  userId: string;
  songTitle: string;
  songFile: string;
  listenedAt: Date;
}

const listenedSongSchema = new Schema<ListenedSong>({
  userId: { type: String, required: true },
  songTitle: { type: String, required: true },
  songFile: { type: String, required: true },
  listenedAt: { type: Date, default: Date.now },
});

const ListenedSongModel = model<ListenedSong>('ListenedSong', listenedSongSchema);

export default ListenedSongModel;