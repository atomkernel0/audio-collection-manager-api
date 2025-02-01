import { IPlaylist } from "../../interfaces/playlist.interface";

export interface UserSearchCriteria {
  username?: string;
  email?: string;
  id?: string;
}

export interface UserSearchResult<T> {
  data: T | null;
  success: boolean;
  error?: {
    message: string;
    code: string;
  };
}

export interface CreateUserInput {
  username: string;
  password: string;
  playlists?: IPlaylist[];
}

export interface CreateUserResult<T> {
  data: T | null;
  success: boolean;
  error?: {
    message: string;
    code: string;
  };
}
