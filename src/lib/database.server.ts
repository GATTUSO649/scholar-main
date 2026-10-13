import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../../drizzle/schema";

let pool: mysql.Pool | undefined;
function createDatabase(connectionPool: mysql.Pool) {
  return drizzle(connectionPool, { schema, mode: "default" });
}
let database: ReturnType<typeof createDatabase> | undefined;

export function getDatabase() {
  const url = process.env["MYSQL_URL"];
  if (!url)
    throw new Error("MYSQL_URL is required. Configure the MySQL database before starting the app.");
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
