import jwt from "jsonwebtoken";
import { TokenPayload, TokenVerificationError } from "./types";
import { logger } from "../..";

/**
 * Verifies and decodes a JWT token
 * @param token - The JWT token to verify
 * @returns CustomJwtPayload - The decoded and typed payload
 * @throws TokenVerificationError
 */
export default function verifyToken(token: string): TokenPayload {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new TokenVerificationError(
        "JWT_SECRET not defined in environment variables"
      );
    }

    const decoded = jwt.verify(token, jwtSecret) as TokenPayload;

    if (!decoded.userId || !decoded.username) {
      throw new TokenVerificationError(
        "Invalid token: missing required fields"
      );
    }

    return decoded;
  } catch (error) {
    logger.error("Error while verifying token:", {
      error: error instanceof Error ? error.message : "Unknown error",
      token: token.substring(0, 10) + "...",
    });

    if (error instanceof jwt.JsonWebTokenError) {
      throw new TokenVerificationError("Invalid token");
    } else if (error instanceof jwt.TokenExpiredError) {
      throw new TokenVerificationError("Token expired");
    } else if (error instanceof TokenVerificationError) {
      throw error;
    }

    throw new TokenVerificationError("Error during token verification");
  }
}
