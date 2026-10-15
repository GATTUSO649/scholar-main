import mysql from "mysql2/promise";

function getConnectionUrl(environment) {
  const directUrl = environment.MYSQL_URL?.trim();
  if (directUrl) return directUrl;

  const host = environment.MYSQLHOST?.trim();
  const username = environment.MYSQLUSER?.trim();
  const database = environment.MYSQLDATABASE?.trim() || environment.MYSQL_DATABASE?.trim();
  if (!host || !username || !database) {
    throw new Error("Configure MYSQL_URL or MYSQLHOST, MYSQLUSER, and MYSQLDATABASE.");
  }

  const url = new URL("mysql://localhost");
  url.hostname = host;
  url.port = environment.MYSQLPORT?.trim() || "3306";
  url.username = username;
  const password =
    environment.MYSQLPASSWORD ||
    (username === "root" ? environment.MYSQL_ROOT_PASSWORD : undefined);
  if (password) url.password = password;
  url.pathname = `/${database}`;
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
