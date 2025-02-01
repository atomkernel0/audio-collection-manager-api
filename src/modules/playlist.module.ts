/**
 * @file playlist.module.ts
 * @description Module grouping PlaylistController and PlaylistService.
 */

import { PlaylistController } from "../controllers/playlist.controller";
import { PlaylistService } from "../services/playlist.service";

export class PlaylistModule {
  public playlistController: PlaylistController;
  public playlistService: PlaylistService;

  constructor() {
    this.playlistService = new PlaylistService();
    this.playlistController = new PlaylistController(this.playlistService);
  }
}
