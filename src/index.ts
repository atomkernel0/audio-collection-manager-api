import path from "path";
import dotenv from "dotenv";
import Koa from "koa";
import mongoose from "mongoose";
import cors from "@koa/cors";
import compress from "koa-compress";
import bodyParser from "koa-bodyparser";
import helmet from "koa-helmet";
import pino from "pino";
import { createRoutes } from "./routes";
import checkRequiredEnvVars from "./utils/common/checkRequiredVars";
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

// Types
interface AppConfig {
  port: number;
  mongoUri: string;
  env: string;
  corsOptions: cors.Options;
}

// Configuration
const config: AppConfig = {
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGO_DB_URI || "",
  env: process.env.NODE_ENV || "development",
  corsOptions: {
    origin: "*",
    credentials: true,
  },
};

// Logger configuration
export const logger = pino({
  transport: {
    target: "pino-pretty",
  },
  level: config.env === "development" ? "debug" : "info",
});

class Server {
  private app: Koa;

  constructor() {
    this.app = new Koa();
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(
      helmet({
        // crossOriginEmbedderPolicy: false,
        // crossOriginResourcePolicy: false,
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            imgSrc: [
              "'self'",
              "data:",
              "https:",
              process.env.CDN_URL || "*.b-cdn.net",
            ],
            connectSrc: ["'self'", "hcaptcha.com", "api.yourservice.com"],
          },
        },
      })
    );
    this.app.use(cors(config.corsOptions));

    // Utility middleware
    this.app.use(compress());
    this.app.use(bodyParser());

    // Logging middleware
    this.app.use(async (ctx, next) => {
      const start = Date.now();
      try {
        await next();
        const ms = Date.now() - start;
        logger.debug({
          method: ctx.method,
          path: ctx.path,
          status: ctx.status,
          duration: `${ms}ms`,
        });
      } catch (error) {
        const ms = Date.now() - start;
        logger.error({
          method: ctx.method,
          path: ctx.path,
          error: error instanceof Error ? error.message : "Unknown error",
          duration: `${ms}ms`,
        });
        throw error;
      }
    });

    // Error handling
    this.app.use(async (ctx, next) => {
      try {
        await next();
      } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Internal Server Error" };
        logger.error(err);
      }
    });
  }

  public async start(): Promise<void> {
    logger.info("Starting server...");

    if (!checkRequiredEnvVars()) {
      logger.fatal("Missing required environment variables");
      process.exit(1);
    }

    logger.debug("Environment variables validation completed successfully");

    const mongooseOptions = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      family: 4,
    };

    try {
      logger.info("Connecting to MongoDB...");

      await mongoose.connect(config.mongoUri, mongooseOptions);

      createRoutes(this.app);

      this.app.listen(config.port, () => {
        logger.info(
          `Server running in ${config.env} mode on http://localhost:${config.port}`
        );
      });
    } catch (error) {
      logger.error(`Failed to start server: ${error}`);
      process.exit(1);
    }
  }

  public getApp(): Koa {
    return this.app;
  }
}

const server = new Server();
server.start().catch((error) => {
  logger.error("Failed to start server:", error);
  process.exit(1);
});

export default server.getApp();
