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
    id: (ctx: Context) => ctx.ip,
    headers: {
      remaining: "Rate-Limit-Remaining",
      reset: "Rate-Limit-Reset",
      total: "Rate-Limit-Total",
    },
    max: 5,
    disableHeader: false,
  });

  router.get("/get-wrapped", rateSettings, getWrapped);

  return router;
};
