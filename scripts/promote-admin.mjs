import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";

const email = process.argv[2]?.trim().toLowerCase();
const databaseUrl = process.env.MYSQL_URL;

if (!email || !databaseUrl) {
  console.error("Usage: npm run db:promote-admin -- user@example.com (with MYSQL_URL configured)");
  process.exitCode = 1;
} else {
  const connection = await mysql.createConnection(databaseUrl);
  try {
    const [rows] = await connection.execute("SELECT id FROM users WHERE email = ? LIMIT 1", [
      email,
    ]);
    const user = rows[0];
    if (!user) throw new Error(`No registered account found for ${email}.`);
    await connection.execute(
      "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'admin') ON DUPLICATE KEY UPDATE role = 'admin'",
      [randomUUID(), user.id],
    );
    console.log(`Administrator role granted to ${email}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}
