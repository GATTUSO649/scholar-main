import { defineConfig } from "drizzle-kit";
import { resolveMigrationDatabaseUrl } from "./src/lib/database.server";

export default defineConfig({
  dialect: "mysql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/mysql-migrations",
  dbCredentials: {
    url: resolveMigrationDatabaseUrl(),
  },
});
