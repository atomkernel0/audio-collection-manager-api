import Router from "koa-router";
import rateLimit from "koa-ratelimit";
import { Context } from "koa";
import { UserModule } from "../modules/user.module";
import verifyAuthorization from "../middlewares/authMiddleware";

const userModule = new UserModule();
const userController = userModule.userController;

const rateSettings = rateLimit({
  driver: "memory",
  db: new Map(),
  duration: 60000,
  errorMessage: "Too many requests, please try again later.",
  id: (ctx: Context) => {
    const identifier = `${ctx.ip || ctx.request.ip || "unknown"}-${
      ctx.headers["user-agent"] || "unknown"
    }`;
    return identifier;
  },
  headers: {
    remaining: "Rate-Limit-Remaining",
    reset: "Rate-Limit-Reset",
    total: "Rate-Limit-Total",
  },
  max: 10,
  disableHeader: false,
});

export const createUserRouter = () => {
  const router = new Router({ prefix: `${process.env.API_PREFIX}` });

  // Test endpoint
  router.get("/", (ctx) => {
    ctx.status = 200;
  });

  // Auth
  router.post("/auth/register", rateSettings, (ctx) =>
    userController.registerUser(ctx)
  );
  router.post("/auth/login", rateSettings, (ctx) =>
    userController.loginUser(ctx)
  );

  // User
  router.get("/users/me", verifyAuthorization, (ctx) =>
    userController.getUserInfo(ctx)
  );

  // Global statistics
  router.get("/stats", (ctx) => userController.getUserListeningStats(ctx));

  // Listening to songs & albums
  router.post("/songs/listen", verifyAuthorization, (ctx) =>
    userController.listenSong(ctx)
  );
  router.get("/songs/history", verifyAuthorization, (ctx) =>
    userController.getListenedSongs(ctx)
  );
  router.post("/albums/listen", verifyAuthorization, (ctx) =>
    userController.listenAlbum(ctx)
  );
  router.get("/albums/listened", verifyAuthorization, (ctx) =>
    userController.getListenedAlbums(ctx)
  );

  // Account modification
  router.patch("/users/username", verifyAuthorization, (ctx) =>
    userController.changeUsername(ctx)
  );
  router.patch("/users/password", verifyAuthorization, (ctx) =>
    userController.changePassword(ctx)
  );

  // Account deletion
  router.delete("/users", verifyAuthorization, (ctx) =>
    userController.deleteAccount(ctx)
  );

  // Favorites
  router.get("/favorite-album", verifyAuthorization, (ctx) =>
    userController.checkIfAlbumIsFavorite(ctx)
  );
  router.post("/favorite-album", verifyAuthorization, (ctx) =>
    userController.addFavoriteAlbum(ctx)
  );
  router.delete("/favorite-album", verifyAuthorization, (ctx) =>
    userController.removeFavoriteAlbum(ctx)
  );
  router.get("/favorite-albums", verifyAuthorization, (ctx) =>
    userController.getFavoriteAlbums(ctx)
  );

  return router;
};
