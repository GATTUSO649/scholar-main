import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../../drizzle/schema";

const normalizeEnvValue = (value: string | undefined) => value?.trim() || undefined;

const directUrlCandidates = ["DATABASE_URL", "POSTGRES_URL", "PG_URL"] as const;

const splitVariableCandidates = {
  host: ["PGHOST", "POSTGRES_HOST"],
  port: ["PGPORT", "POSTGRES_PORT"],
  username: ["PGUSER", "POSTGRES_USER"],
  password: ["PGPASSWORD", "POSTGRES_PASSWORD"],
  database: ["PGDATABASE", "POSTGRES_DB", "POSTGRES_DATABASE"],
} as const;

let pool: ReturnType<typeof postgres> | undefined;
function createDatabase(connectionPool: ReturnType<typeof postgres>) {
  return drizzle(connectionPool, { schema });
}
let database: ReturnType<typeof createDatabase> | undefined;

function resolveValue(environment: Record<string, string | undefined>, keys: readonly string[]) {
  for (const key of keys) {
    const value = normalizeEnvValue(environment[key]);
    if (value) return value;
  }
  return undefined;
}

export function resolveDatabaseUrl(environment: Record<string, string | undefined> = process.env) {
  const directUrl = directUrlCandidates
    .map((key) => normalizeEnvValue(environment[key]))
    .find((value): value is string => Boolean(value));
  if (directUrl) return directUrl;

  const host = resolveValue(environment, splitVariableCandidates.host);
  const username = resolveValue(environment, splitVariableCandidates.username);
  const databaseName = resolveValue(environment, splitVariableCandidates.database);
  if (!host || !username || !databaseName) {
    throw new Error("Set DATABASE_URL or provide PGHOST, PGUSER, and PGDATABASE/POSTGRES_DB.");
  }

  const url = new URL("postgres://localhost");
  url.hostname = host;
  url.port = resolveValue(environment, splitVariableCandidates.port) || "5432";
  url.username = username;
  const password = resolveValue(environment, splitVariableCandidates.password);
  if (password) url.password = password;
  url.pathname = `/${databaseName.replace(/^\/+/, "")}`;
  return url.toString();
}

export function resolveMigrationDatabaseUrl(
  environment: Record<string, string | undefined> = process.env,
) {
  const migrationUrl =
    normalizeEnvValue(environment["DATABASE_MIGRATION_URL"]) ||
    normalizeEnvValue(environment["POSTGRES_MIGRATION_URL"]);

  if (migrationUrl) {
    try {
      const parsedUrl = new URL(migrationUrl);
      if (
        (parsedUrl.protocol === "postgres:" || parsedUrl.protocol === "postgresql:") &&
        parsedUrl.hostname &&
        parsedUrl.pathname.length > 1
      ) {
        return migrationUrl;
      }
    } catch {
      // Fall back to the application database URL when no valid migration URL is configured.
    }
  }
  return resolveDatabaseUrl(environment);
}

export function getDatabase() {
  const url = resolveDatabaseUrl();
  if (!pool) {
    const ssl =
      process.env["NODE_ENV"] === "production" || url.includes("supabase") ? "require" : false;
    pool = postgres(url, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      ssl,
    });
    database = createDatabase(pool);
  }
  return database!;
}

export async function closeDatabase() {
  if (!pool) return;
  const currentPool = pool;
  pool = undefined;
  database = undefined;
  await currentPool.end();
}
