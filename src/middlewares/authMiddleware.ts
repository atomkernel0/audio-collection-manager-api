import { Context, Next } from "koa";
import jwt from "jsonwebtoken";
import "dotenv/config";

/**
 * JWT verification middleware
 * Verifies the JWT token from the Authorization header
 *
 * @param ctx - Koa context
 * @param next - Next middleware function
 */
export default async function verifyAuthorization(
  ctx: Context,
  next: Next
): Promise<void> {
  const authHeader = ctx.headers.authorization;

  if (!authHeader) {
    ctx.status = 401;
    ctx.body = { error: "Missing token" };
    return;
  }

  const [bearer, token] = authHeader.split(" ");

  if (bearer !== "Bearer" || !token) {
    ctx.status = 401;
    ctx.body = { error: "Invalid token format" };
    return;
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      ctx.status = 500;
      ctx.body = { error: "JWT configuration missing" };
      return;
    }

    // Verify and decode token
    jwt.verify(token, secret);

    await next();
  } catch (error) {
    ctx.status = 401;
    ctx.body = { error: "Invalid token" };
  }
}
