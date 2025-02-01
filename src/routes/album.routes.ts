import Router from "koa-router";
import { AlbumService } from "@/services/album.service";
import { AlbumController } from "@/controllers/album.controller";

export const createAlbumRouter = () => {
  const router = new Router({ prefix: `${process.env.API_PREFIX}/albums` });
  const albumService = new AlbumService();
  const albumController = new AlbumController(albumService);

  router.get("/", (ctx) => albumController.getAlbums(ctx));
  router.get("/order", (ctx) => albumController.getAlbumsByOrder(ctx));
  router.get("/album", (ctx) => albumController.getAlbum(ctx));
  router.get("/search", (ctx) => albumController.searchAlbums(ctx));
  router.get("/artists", (ctx) => albumController.getArtists(ctx));
  router.get("/most-listened", (ctx) =>
    albumController.getMostListenedAlbums(ctx)
  );
  router.get("/primary-color", (ctx) => albumController.getPrimaryColor(ctx));
  router.get("/random", (ctx) => albumController.getRandomAlbums(ctx));
  router.get("/songs", (ctx) => albumController.searchSongs(ctx));
  router.get("/artist/:artist", (ctx) =>
    albumController.getAlbumsByArtist(ctx)
  );
  router.get("/genre", (ctx) => albumController.getAlbumsByGenre(ctx));

  return router;
};
