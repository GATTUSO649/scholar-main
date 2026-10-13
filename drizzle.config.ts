import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "mysql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/mysql-migrations",
  dbCredentials: {
    url: process.env["MYSQL_MIGRATION_URL"] || process.env["MYSQL_URL"] || "",
  },
});
