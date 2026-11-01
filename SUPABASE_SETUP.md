# Supabase Setup

ScholarDesk uses PostgreSQL through Drizzle and `postgres.js`. The Supabase JavaScript client and Supabase Auth are not used; the application keeps its existing server-side authentication, role checks, password hashes, and opaque database-backed sessions. Never expose a database URL or use a Supabase browser client for application data.

## Create the database

1. Create a Supabase project and record its database password in a password manager.
2. In **Project Settings → Database → Connect**, choose a PostgreSQL connection string. For Render, prefer the Supabase session pooler when the Render service cannot use the direct IPv6 endpoint. The app disables prepared statements and enables TLS in production; the session pooler is suitable for the app's long-lived PostgreSQL client. Do not select transaction pooling unless it is required for network compatibility and has been verified with the production workload.
3. Set `DATABASE_URL` in Render to the PostgreSQL URI. Keep credentials server-side. URL-encode reserved characters in the password.
4. Optionally set `DATABASE_MIGRATION_URL` to a separate PostgreSQL role with the schema privileges Drizzle migrations need. Otherwise migrations use `DATABASE_URL`.
5. Set the same `DATABASE_URL` in local `.env` for development. `.env.example` contains placeholders only.

Required application variable:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/postgres
```

Optional variable:

```dotenv
DATABASE_MIGRATION_URL=postgresql://MIGRATION_USER:PASSWORD@HOST:PORT/postgres
```

A Supabase `service_role` key is not a database URL and must not be used as one. Do not add Supabase Auth, a browser-side database client, or broad RLS policies: current access control relies on the server session and server-side authorization. Supabase's default database role has broad privileges; for production, use a dedicated runtime role restricted to the application schema/tables and a separate migration role. Do not grant the runtime role ownership or general DDL rights.

## Initialize or update the schema

Install dependencies and apply the reviewed, additive Drizzle migration:

```sh
npm ci
npm run db:migrate
npm run db:check
```

The active PostgreSQL migration chain is `drizzle/migrations/`; the initial migration creates the current 16-table application schema, enums, constraints, and indexes. The historical MySQL migrations under `drizzle/mysql-migrations/` are reference-only and must never be applied to PostgreSQL. Review newly generated SQL before applying it. Render intentionally does not auto-run schema migrations: apply reviewed migrations as a controlled deployment step so destructive SQL is never silently executed against production.

For an empty development database, install the public default service catalog after migration:

```sh
npm run db:seed
```

The seed command inserts missing catalog/settings rows only. It creates no users and does not overwrite existing rows. Do not seed a migration destination before data import.

## Render configuration

Configure `DATABASE_URL`, `APP_URL`, and `FILE_STORAGE_DIR` in the Render service environment. Set `DATABASE_MIGRATION_URL` only when using a separate migration account. Keep SMTP, admin-signup, and M-PESA secrets in Render's environment settings. `render.yaml` declares environment values as unsynchronized placeholders; it does not provision a Supabase project or migrate existing data.

Use a persistent private disk for uploads. Back up that disk separately from PostgreSQL, as explained in [DATABASE_BACKUP_AND_RESTORE.md](DATABASE_BACKUP_AND_RESTORE.md).

## Diagnostics

Run `npm run db:check` from a machine that can reach the database. It runs `SELECT 1` and reports the database name plus a sanitized error code. It does not print the connection URL. Common causes of failure include a malformed/URL-unescaped password, incorrect pooler host or port, network restrictions, missing TLS, and an unavailable project. Never disable TLS verification as a workaround; check Supabase's current connection details and CA guidance.
