import Koa from "koa";
import { createAlbumRouter } from "./album.routes";
import { createUserRouter } from "./user.routes";
import { createPlaylistRouter } from "./playlist.routes";
import { createWrappedRouter } from "./wrappedRouter";

export const createRoutes = async (app: Koa) => {
  const albumRouter = createAlbumRouter();
  const userRouter = createUserRouter();
  const playlistRouter = createPlaylistRouter();
  const wrappedRouter = createWrappedRouter();

  app.use(userRouter.routes());
  app.use(albumRouter.routes());
  app.use(playlistRouter.routes());
  app.use(wrappedRouter.routes());

  app.use(userRouter.allowedMethods());
  app.use(albumRouter.allowedMethods());
  app.use(playlistRouter.allowedMethods());
  app.use(wrappedRouter.allowedMethods());
};
