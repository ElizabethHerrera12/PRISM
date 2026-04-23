import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number.parseInt(process.env.PORT ?? "4000", 10),
  dbHost: process.env.DB_HOST ?? "127.0.0.1",
  dbPort: Number.parseInt(process.env.DB_PORT ?? "3306", 10),
  dbName: process.env.DB_NAME ?? "prism_document",
  dbUser: process.env.DB_USER ?? "prism",
  dbPassword: process.env.DB_PASSWORD ?? "change_me",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
};
