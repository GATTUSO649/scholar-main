import { randomUUID } from "node:crypto";
import postgres from "postgres";

const email = process.argv[2]?.trim().toLowerCase();
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!email || !databaseUrl) {
  console.error(
    "Usage: npm run db:promote-admin -- user@example.com (with DATABASE_URL configured)",
  );
  process.exitCode = 1;
} else {
  const connection = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    const [user] = await connection`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
    if (!user) throw new Error(`No registered account found for ${email}.`);
    await connection`
      INSERT INTO user_roles (id, user_id, role)
      VALUES (${randomUUID()}, ${user.id}, 'admin')
      ON CONFLICT (user_id, role) DO UPDATE SET role = EXCLUDED.role
    `;
    console.log(`Administrator role granted to ${email}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}
