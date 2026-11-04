import { randomUUID } from "node:crypto";
import postgres from "postgres";

const email = process.argv[2]?.trim().toLowerCase();
const actorEmail = process.argv[3]?.trim().toLowerCase();
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!email || !databaseUrl) {
  console.error(
    "Usage: npm run db:promote-admin -- user@example.com [admin-actor@example.com] (with DATABASE_URL configured)",
  );
  process.exitCode = 1;
} else {
  const connection = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    await connection.begin(async (transaction) => {
      const [user] = await transaction`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
      if (!user) throw new Error("No registered account found for the requested promotion.");
      const [actor] = actorEmail
        ? await transaction`
            SELECT users.id, users.email
            FROM users
            INNER JOIN user_roles ON user_roles.user_id = users.id
            WHERE users.email = ${actorEmail} AND user_roles.role = 'admin'
            LIMIT 1
          `
        : [];
      if (actorEmail && !actor)
        throw new Error("The audit actor must be an existing administrator.");

      await transaction`
        INSERT INTO user_roles (id, user_id, role)
        VALUES (${randomUUID()}, ${user.id}, 'admin')
        ON CONFLICT (user_id, role) DO NOTHING
      `;
      await transaction`
        INSERT INTO admin_audit_events
          (id, actor_user_id, actor_email, action, target_type, target_id, metadata)
        VALUES (
          ${randomUUID()},
          ${actor?.id ?? null},
          ${actor?.email ?? "operator:promote-admin-script"},
          'admin.role_granted',
          'user',
          ${user.id},
          ${JSON.stringify({ channel: "cli" })}::jsonb
        )
      `;
    });
    console.log("Administrator role granted and audited.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}
