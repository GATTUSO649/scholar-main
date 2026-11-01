import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

function normalize(value) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function firstValue(environment, keys) {
  for (const key of keys) {
    const value = normalize(environment[key]);
    if (value) return value;
  }
  return undefined;
}

function resolveDatabaseUrl(environment = process.env) {
  const migrationUrl = firstValue(environment, [
    "DATABASE_MIGRATION_URL",
    "POSTGRES_MIGRATION_URL",
  ]);
  if (migrationUrl) {
    try {
      const parsed = new URL(migrationUrl);
      if (
        ["postgres:", "postgresql:"].includes(parsed.protocol) &&
        parsed.hostname &&
        parsed.pathname.length > 1
      ) {
        return migrationUrl;
      }
    } catch {
      // Fall back to the application database URL.
    }
  }

  const directUrl = firstValue(environment, ["DATABASE_URL", "POSTGRES_URL", "PG_URL"]);
  if (directUrl) return directUrl;

  const host = firstValue(environment, ["PGHOST", "POSTGRES_HOST"]);
  const username = firstValue(environment, ["PGUSER", "POSTGRES_USER"]);
  const database = firstValue(environment, [
    "PGDATABASE",
    "POSTGRES_DB",
    "POSTGRES_DATABASE",
  ]);
  if (!host || !username || !database) {
    throw new Error("Set DATABASE_URL or provide PGHOST, PGUSER, and PGDATABASE/POSTGRES_DB.");
  }

  const url = new URL("postgres://localhost");
  url.hostname = host;
  url.port = firstValue(environment, ["PGPORT", "POSTGRES_PORT"]) || "5432";
  url.username = username;
  const password = firstValue(environment, ["PGPASSWORD", "POSTGRES_PASSWORD"]);
  if (password) url.password = password;
  url.pathname = `/${database.replace(/^\/+/, "")}`;
  return url.toString();
}

const databaseUrl = resolveDatabaseUrl();
const database = postgres(databaseUrl, {
  max: 1,
  connect_timeout: 10,
  prepare: false,
  ssl: process.env.NODE_ENV === "production" || databaseUrl.includes("supabase") ? "require" : false,
});

try {
  await migrate(drizzle(database), { migrationsFolder: "./drizzle/migrations" });
  console.log("Database migrations completed.");
} catch (error) {
  const code =
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code
      : "MIGRATION_FAILED";
  console.error(`Database migration failed (${code}).`);
  process.exitCode = 1;
} finally {
  await database.end();
}