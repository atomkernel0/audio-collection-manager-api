import Router from "koa-router";
import { Context } from "vm";
import { getWrapped } from "../controllers/wrappedController";
import rateLimit from "koa-ratelimit";

export const createWrappedRouter = () => {
  const router = new Router({ prefix: `${process.env.API_PREFIX}/wrapped` });

  const rateSettings = rateLimit({
    driver: "memory",
    db: new Map(),
    duration: 60000,
    errorMessage: "Too many requests, please try again later.",
    id: (ctx: Context) => {
      // Use a combination of IP and user agent to better identify unique clients
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
    max: 20, // Increased from 5 to 20 requests per minute
    disableHeader: false,
  });

  router.get("/get-wrapped", rateSettings, getWrapped);

  return router;
};
