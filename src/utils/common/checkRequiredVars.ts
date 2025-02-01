import { logger } from "../..";

export default function checkRequiredEnvVars() {
  const required = [
    "MONGO_DB_URI",
    "JWT_SECRET",
    "CDN_URL",
    "HCAPTCHA_TOKEN",
    "STREAM_TOKEN_SECRET",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    logger.error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
    logger.debug(
      "Available environment variables:",
      Object.keys(process.env)
        .filter((key) => !key.includes("SECRET"))
        .reduce((acc, key) => ({ ...acc, [key]: process.env[key] }), {})
    );
    return false;
  }
  return true;
}
