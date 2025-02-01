import jwt from "jsonwebtoken";
import "dotenv/config";
import { TokenGenerationError, TokenPayload } from "./types";
import { logger } from "../..";

/**
 * Creates a JWT token with provided user information
 * @param userId - The unique identifier of the user
 * @param username - The username of the user
 * @returns string - The generated JWT token
 * @throws TokenGenerationError
 */
export default function createToken(userId: string, username: string): string {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new TokenGenerationError(
        "JWT_SECRET not defined in environment variables"
      );
    }

    if (!userId?.trim() || !username?.trim()) {
      throw new TokenGenerationError("Invalid user credentials provided");
    }

    const payload: TokenPayload = {
      userId,
      username,
    };

    const token = jwt.sign(payload, jwtSecret, { expiresIn: "88d" });

    return token;
  } catch (error) {
    logger.error("Error generating token:", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId,
      username,
    });

    throw new TokenGenerationError(
      "Failed to generate token: " +
        (error instanceof Error ? error.message : "Unknown error")
    );
  }
}
