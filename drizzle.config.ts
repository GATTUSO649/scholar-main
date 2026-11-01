import { defineConfig } from "drizzle-kit";
import { resolveMigrationDatabaseUrl } from "./src/lib/database.server";

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: resolveMigrationDatabaseUrl(),
  },
});
