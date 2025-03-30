import Router from "koa-router";
import { RecommendationsService } from "@/services/recommendations.service";
import { RecommendationsController } from "@/controllers/recommendations.controller";

export const createRecommendationRouter = () => {
  const router = new Router({
    prefix: `${process.env.API_PREFIX}/recommendations`,
  });
  const recommendationsService = new RecommendationsService();
  const recommendationsController = new RecommendationsController(
    recommendationsService
  );

  router.get("/", (ctx) =>
    recommendationsController.getPersonalizedRecommendations(ctx)
  );

  return router;
};
