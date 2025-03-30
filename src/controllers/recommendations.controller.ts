/**
 * @file recommendations.controller.ts
 * @description Controller for handling music recommendations requests.
 */

import { Context } from "koa";
import { verifyToken } from "../utils";
import { logger } from "..";
import { RecommendationsService } from "@/services/recommendations.service";

/**
 * Handles errors by setting the context status and body, and logging the error.
 * @param ctx - The Koa context object.
 * @param status - The HTTP status code.
 * @param message - The error message.
 */
const handleError = (ctx: Context, status: number, message: string) => {
  ctx.status = status;
  ctx.body = { error: message };
  logger.error(`Recommendation Error [${status}]: ${message}`);
};

/**
 * Controller class for managing music recommendations.
 */
export class RecommendationsController {
  /**
   * Creates an instance of RecommendationsController.
   * @param recommendationsService - The service responsible for recommendation logic.
   */
  constructor(
    private readonly recommendationsService: RecommendationsService
  ) {}

  /**
   * Retrieves personalized music recommendations for the authenticated user.
   * @param ctx - The Koa context object.
   */
  public async getPersonalizedRecommendations(ctx: Context): Promise<void> {
    try {
      const token = ctx.request.headers.authorization?.split(" ")[1];
      if (!token) {
        return handleError(ctx, 401, "Authentication required");
      }

      const decoded = verifyToken(token);
      const userId = decoded.userId;

      const recommendations =
        await this.recommendationsService.generateRecommendations(userId);

      ctx.status = 200;
      ctx.body = { recommendations };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("No listening history")
      ) {
        handleError(ctx, 404, error.message);
      } else {
        console.error("Recommendation error:", error);
        handleError(ctx, 500, "Failed to generate recommendations");
      }
    }
  }
}
