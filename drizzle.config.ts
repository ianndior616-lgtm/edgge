import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";
import { databaseConfigurationHint, databaseUrlFromEnv } from "./src/lib/database-url";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const url = databaseUrlFromEnv();

if (!url) {
  throw new Error(`PostgreSQL connection is required. ${databaseConfigurationHint()}`);
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url,
  },
});
