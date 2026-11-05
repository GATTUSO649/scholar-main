# Supabase Setup

ScholarDesk uses PostgreSQL through Drizzle and `postgres.js`. The `@supabase/supabase-js` client is used server-side only for private Storage; Supabase Auth is not used. The application keeps its existing server-side authentication, role checks, password hashes, and opaque database-backed sessions. Never expose a database URL or use a Supabase browser client for application data.

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

A Supabase `service_role` key is not a database URL and must not be used as one. Supabase Auth and browser-side database clients are not used; application access is authorized by server sessions and backend permission checks. Migration `0007_many_slyde.sql` enables RLS on all current public application tables and revokes table, sequence, and function privileges from `anon` and `authenticated`, leaving the Supabase Data API roles with no direct application-data access. No RLS policies are defined, so these roles fail closed. The server currently connects with the `postgres` role, which has `BYPASSRLS`; a replacement runtime role without `BYPASSRLS` requires a separately reviewed policy design before deployment.

Migration 0007 also revokes default public-schema object grants for `postgres`. The current database has separate default ACLs owned by `supabase_admin`, which the application's migration role cannot change. A Supabase owner should run the following in the SQL Editor, using an appropriately privileged account, to prevent future objects created by `supabase_admin` from inheriting Data API grants:

```sql
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
	REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
	REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
	REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
```

The existing `rls_auto_enable` event trigger enables RLS on new public tables, but it does not replace these default-privilege revokes. Review future public functions before granting execution to either Data API role.

## Initialize or update the schema

Install dependencies and apply the reviewed, additive Drizzle migrations:

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

## Private file storage

1. In Supabase **Storage**, create a bucket named `private-uploads` and leave **Public bucket** disabled.
2. Set `SUPABASE_URL` to the project's HTTPS URL, `SUPABASE_SERVICE_ROLE_KEY` to the server-only service role key, and `SUPABASE_STORAGE_BUCKET=private-uploads` in the hosting provider's environment settings.
3. Keep the service role key exclusively on the server. Do not add it to `VITE_*` variables, client code, logs, or source control. Storage calls use a 45-second per-request timeout and retry transient network failures at most twice. Diagnostics log the destination hostname and request metadata, never credentials, object paths, or file contents.
4. PostgreSQL stores only file metadata and storage keys. Uploads and downloads go through server handlers that check the current session, ownership/admin role, and payment status before accessing the private bucket.

Render does not need a persistent disk for new uploads with this setup. To verify the configured connection, bucket privacy, upload, download, and cleanup, run `npm run files:diagnose-storage`. The diagnostic uses a unique temporary object and removes it; it does not alter application files or metadata.

Legacy files are never migrated or deleted automatically. For a manual migration, first preserve a backup of the old upload directory, make that directory available to a trusted machine with the application configured to use the intended Supabase project, set `LEGACY_FILE_STORAGE_DIR` to that directory, and run `npm run files:migrate-to-object-storage`. The command verifies the bucket and leaves source files untouched; objects already at the target paths are skipped. Review the copied/skipped counts and verify representative authorized downloads before retiring the old source. The local workspace currently has no `data/uploads` directory; Render's former filesystem cannot be inspected from this repository, so confirm any old Render disk/snapshot or external backup separately. Back up bucket objects separately from PostgreSQL, as explained in [DATABASE_BACKUP_AND_RESTORE.md](DATABASE_BACKUP_AND_RESTORE.md).

## Render configuration

Configure `DATABASE_URL`, `APP_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` in the Render service environment. Set `DATABASE_MIGRATION_URL` only when using a separate migration account. Keep SMTP, admin-signup, and M-PESA secrets in Render's environment settings. `render.yaml` declares environment values as unsynchronized placeholders; it does not provision a Supabase project, bucket, or migrate existing data.

## Diagnostics

Run `npm run db:check` from a machine that can reach the database. It runs `SELECT 1` and reports the database name plus a sanitized error code. It does not print the connection URL. Common causes of failure include a malformed/URL-unescaped password, incorrect pooler host or port, network restrictions, missing TLS, and an unavailable project. Never disable TLS verification as a workaround; check Supabase's current connection details and CA guidance.
