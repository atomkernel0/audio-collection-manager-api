import { JwtPayload } from "jsonwebtoken";

// Custom payload interface
export interface TokenPayload extends JwtPayload {
  userId: string;
  username: string;
}

// Custom error class
export class TokenVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenVerificationError";
  }
}

// Custom error class
export class TokenGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenGenerationError";
  }
}
