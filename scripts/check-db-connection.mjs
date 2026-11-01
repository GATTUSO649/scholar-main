import postgres from "postgres";

function normalizeEnvValue(value) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function getConnectionUrl(environment) {
  const directUrl =
    normalizeEnvValue(environment.DATABASE_URL) || normalizeEnvValue(environment.POSTGRES_URL);
  if (directUrl) return directUrl;

  const host =
    normalizeEnvValue(environment.PGHOST) || normalizeEnvValue(environment.POSTGRES_HOST);
  const username =
    normalizeEnvValue(environment.PGUSER) || normalizeEnvValue(environment.POSTGRES_USER);
  const database =
    normalizeEnvValue(environment.PGDATABASE) ||
    normalizeEnvValue(environment.POSTGRES_DB) ||
    normalizeEnvValue(environment.POSTGRES_DATABASE);
  if (!host || !username || !database) {
    throw new Error("Configure DATABASE_URL or PGHOST, PGUSER, and PGDATABASE.");
  }

  const url = new URL("postgres://localhost");
  url.hostname = host;
  url.port =
    normalizeEnvValue(environment.PGPORT) || normalizeEnvValue(environment.POSTGRES_PORT) || "5432";
  url.username = username;
  const password =
    normalizeEnvValue(environment.PGPASSWORD) || normalizeEnvValue(environment.POSTGRES_PASSWORD);
  if (password) url.password = password;
  url.pathname = `/${database.replace(/^\/+/, "")}`;
  return url.toString();
}

let connection;
try {
  const connectionUrl = getConnectionUrl(process.env);
  connection = postgres(connectionUrl, {
    max: 1,
    connect_timeout: 10,
    ssl:
      process.env.NODE_ENV === "production" || connectionUrl.includes("supabase")
        ? "require"
        : false,
    prepare: false,
  });
  const [row] = await connection`SELECT 1 AS connected, current_database() AS database_name`;
  if (Number(row?.connected) !== 1 || !row.database_name) {
    throw new Error("The server did not select a database.");
  }
  console.log(`PostgreSQL connection succeeded for database: ${row.database_name}`);
} catch (error) {
  const code =
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code
      : "CONNECTION_FAILED";
  console.error(
    `PostgreSQL connection failed (${code}). Check credentials, database, and network access.`,
  );
  process.exitCode = 1;
} finally {
  if (connection) await connection.end().catch(() => {});
}
