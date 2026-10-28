import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Same .env.local loading as `next dev`.
loadEnvConfig(process.cwd());

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/shared/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
