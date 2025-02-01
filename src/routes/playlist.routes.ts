import Router from "koa-router";
import rateLimit from "koa-ratelimit";
import { Context } from "koa";
import verifyAuthorization from "../middlewares/authMiddleware";
import { PlaylistModule } from "../modules/playlist.module";

const playlistModule = new PlaylistModule();
const playlistController = playlistModule.playlistController;

// Standard rate limiter for read operations
const standardLimiter = rateLimit({
  driver: "memory",
  db: new Map(),
  duration: 60000, // 1 minute
  max: 100,
  id: (ctx: Context) => ctx.ip,
  errorMessage: "Too many requests. Please try again later.",
});

// Strict rate limiter for write operations
const strictLimiter = rateLimit({
  driver: "memory",
  db: new Map(),
  duration: 60000,
  max: 20,
  id: (ctx: Context) => ctx.ip,
  errorMessage: "Too many requests. Please try again later.",
});

export const createPlaylistRouter = () => {
  const router = new Router({ prefix: `${process.env.API_PREFIX}/playlists` });

  // Protected routes - Favorites management
  router.get("/favorite", verifyAuthorization, standardLimiter, async (ctx) =>
    playlistController.getFavoritePlaylist(ctx)
  );
  router.post(
    "/favorite/toggle",
    verifyAuthorization,
    standardLimiter,
    async (ctx) => playlistController.toggleSongInFavoritePlaylist(ctx)
  );
  router.get(
    "/favorite/check",
    verifyAuthorization,
    standardLimiter,
    async (ctx) => playlistController.isSongFavorite(ctx)
  );

  // Public routes
  router.get("/:playlistId", standardLimiter, async (ctx) =>
    playlistController.getPlaylist(ctx)
  );

  // Protected routes - Playlist management
  router.get("/", verifyAuthorization, standardLimiter, async (ctx) =>
    playlistController.getUserPlaylists(ctx)
  );
  router.post("/", verifyAuthorization, strictLimiter, async (ctx) =>
    playlistController.addSongToPlaylist(ctx)
  );
  router.patch(
    "/:playlistId",
    verifyAuthorization,
    strictLimiter,
    async (ctx) => playlistController.editPlaylistName(ctx)
  );
  router.delete(
    "/:playlistId",
    verifyAuthorization,
    strictLimiter,
    async (ctx) => playlistController.deletePlaylist(ctx)
  );

  // Protected routes - Playlist content management
  router.put(
    "/:playlistId/order",
    verifyAuthorization,
    strictLimiter,
    async (ctx) => playlistController.updatePlaylistOrder(ctx)
  );
  router.put(
    "/:playlistId/privacy",
    verifyAuthorization,
    strictLimiter,
    async (ctx) => playlistController.togglePlaylistPrivacy(ctx)
  );
  router.delete(
    "/:playlistId/songs/:songId",
    verifyAuthorization,
    strictLimiter,
    async (ctx) => playlistController.deleteSongFromPlaylist(ctx)
  );

  return router;
};
