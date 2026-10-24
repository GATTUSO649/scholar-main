import mysql from "mysql2/promise";

function normalizeEnvValue(value) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function getConnectionUrl(environment) {
  const directUrl = normalizeEnvValue(environment.MYSQL_URL);
  if (directUrl) return directUrl;

  const host = normalizeEnvValue(environment.MYSQLHOST);
  const username = normalizeEnvValue(environment.MYSQLUSER);
  const database =
    normalizeEnvValue(environment.MYSQLDATABASE) || normalizeEnvValue(environment.MYSQL_DATABASE);
  if (!host || !username || !database) {
    throw new Error("Configure MYSQL_URL or MYSQLHOST, MYSQLUSER, and MYSQLDATABASE.");
  }

  const url = new URL("mysql://localhost");
  url.hostname = host;
  url.port = normalizeEnvValue(environment.MYSQLPORT) || "3306";
  url.username = username;
  const password =
    normalizeEnvValue(environment.MYSQLPASSWORD) ||
    (username === "root" ? normalizeEnvValue(environment.MYSQL_ROOT_PASSWORD) : undefined);
  if (password) url.password = password;
  url.pathname = `/${database.replace(/^\/+/, "")}`;
  return url.toString();
}

let connection;
try {
  connection = await mysql.createConnection({
    uri: getConnectionUrl(process.env),
    connectTimeout: 10000,
  });
  const [rows] = await connection.query("SELECT 1 AS connected, DATABASE() AS database_name");
  const result = rows[0];
  if (Number(result?.connected) !== 1 || !result.database_name) {
    throw new Error("The server did not select a database.");
  }
  console.log(`MySQL connection succeeded for database: ${result.database_name}`);
} catch (error) {
  const code =
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code
      : "CONNECTION_FAILED";
  console.error(
    `MySQL connection failed (${code}). Check credentials, database, and network access.`,
  );
  process.exitCode = 1;
} finally {
  if (connection) await connection.end().catch(() => {});
}
