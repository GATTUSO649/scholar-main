import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../../drizzle/schema";

let pool: mysql.Pool | undefined;
function createDatabase(connectionPool: mysql.Pool) {
  return drizzle(connectionPool, { schema, mode: "default" });
}
let database: ReturnType<typeof createDatabase> | undefined;

export function resolveDatabaseUrl(environment: Record<string, string | undefined> = process.env) {
  const directUrl = environment["MYSQL_URL"];
  if (directUrl) return directUrl;

  const host = environment["MYSQLHOST"];
  const username = environment["MYSQLUSER"];
  const databaseName = environment["MYSQLDATABASE"] || environment["MYSQL_DATABASE"];
  if (!host || !username || !databaseName) {
    throw new Error(
      "Set MYSQL_URL or provide MYSQLHOST, MYSQLUSER, and MYSQLDATABASE/MYSQL_DATABASE.",
    );
  }

  const url = new URL("mysql://localhost");
  url.hostname = host;
  url.port = environment["MYSQLPORT"] || "3306";
  url.username = username;
  const password =
    environment["MYSQLPASSWORD"] ||
    (username === "root" ? environment["MYSQL_ROOT_PASSWORD"] : undefined);
  if (password) url.password = password;
  url.pathname = `/${databaseName}`;
  return url.toString();
}

export function resolveMigrationDatabaseUrl(
  environment: Record<string, string | undefined> = process.env,
) {
  const migrationUrl = environment["MYSQL_MIGRATION_URL"]?.trim();
  if (migrationUrl) {
    try {
      const parsedUrl = new URL(migrationUrl);
      if (parsedUrl.protocol === "mysql:" && parsedUrl.hostname && parsedUrl.pathname.length > 1) {
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
    const parsedUrl = new URL(url);
    parsedUrl.searchParams.set("timezone", "Z");
    pool = mysql.createPool(parsedUrl.toString());
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
