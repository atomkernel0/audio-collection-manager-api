export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      JWT_SECRET: string;
      API_PREFIX: string;
      MONGO_DB_URI: string;
      CDN_URL: string;
      HCAPTCHA_TOKEN: string;
      STREAM_TOKEN_SECRET: string;
    }
  }
}
