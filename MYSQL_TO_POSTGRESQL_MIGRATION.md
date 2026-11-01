# MySQL to PostgreSQL Migration

## Scope and status

The active application database is PostgreSQL. The Drizzle schema is PostgreSQL-native and the active migration chain is `drizzle/migrations/`. The 15 historical MySQL SQL migrations and their Drizzle snapshots remain archived under `drizzle/mysql-migrations/`; they contain MySQL-only syntax (backtick identifiers, MySQL `ENUM`, `datetime(3)`, `DATE_ADD`, and `ON UPDATE`) and are not executable PostgreSQL migrations.

The current ScholarDesk schema has 16 tables: `users`, `profiles`, `user_roles`, `sessions`, `password_reset_tokens`, `email_verification_tokens`, `login_attempts`, `services`, `requests`, `request_updates`, `request_files`, `library_resources`, `library_purchases`, `faq_entries`, `site_settings`, and `notifications`. This repository does not contain school/teacher/parent/attendance/exam/assignment SIS tables. No production data is claimed migrated until an operator runs the importer against the real endpoints and reviews its verification report.

## Preconditions

1. Schedule a maintenance window and stop writes to the MySQL application. Confirm the MySQL server timezone and how historical `DATETIME` values are intended to be interpreted. Those values have no timezone metadata; the importer preserves wall-clock text and PostgreSQL interprets it in UTC. If the source values represent a local timezone, decide and test a conversion before importing.
2. Back up MySQL and verify that the backup can be read. Also back up the private `FILE_STORAGE_DIR`; database migration does not copy file bytes.
3. Create a new Supabase database/schema with no application rows. Do not point the running app at the destination yet.
4. Configure local/server-shell variables `DATABASE_URL` for the target PostgreSQL and `MYSQL_SOURCE_URL` for the source MySQL. Keep them out of source control, terminal transcripts, chat, and logs. `MYSQL_SOURCE_URL` is used only by the explicit migration script and must never be set on Render.
5. Apply the PostgreSQL schema first and check connectivity:

   ```sh
   npm ci
   npm run db:migrate
   npm run db:check
   ```

6. Run a read-only count preflight:

   ```sh
   npm run db:import-mysql -- --dry-run
   ```

   Review the source and destination counts. Confirm the destination has zero rows in all 16 tables.

## Import

Run the transfer from a trusted host with network access to both endpoints:

```sh
npm run db:import-mysql
```

The importer copies all columns and primary keys in foreign-key order, including existing password hashes, role rows, sessions/tokens, payment records, timestamps, and JSON callback data. It does not create users, reset passwords, modify source records, or overwrite destination rows. Inserts use PostgreSQL `ON CONFLICT DO NOTHING`; a colliding destination row is accepted only when all source and destination column values compare equal. A different collision stops the import with an error.

If a run is interrupted, inspect the destination and preserve a backup before resuming:

```sh
npm run db:import-mysql -- --resume
```

`--resume` is explicit. It accepts only byte/value-equivalent rows for colliding primary keys. At completion, the script requires exact per-table source/destination row counts, reports role counts and request/payment states, and checks every declared foreign-key relationship for orphans. Extra destination data or a mismatch is a failed verification, not a successful migration. The importer performs no schema DDL and does not truncate tables.

The import transfers `request_files` and `library_resources` metadata, not their private file bytes. Copy the complete private file-storage tree separately, preserving each storage key and filename, verify the copied files, and keep it outside the public web root. Do not switch traffic until both database and file verification succeed.

## Cutover and rollback

1. Retain the MySQL backup and keep writes disabled while reviewing the import report and running the application checks below.
2. Test existing user/student and administrator sign-in with existing credentials; password hashes and role rows are copied unchanged. Verify sessions, password reset/email verification, profile reads, requests, downloads, notifications, and paid-purchase access. Complete a controlled payment test only in an approved test environment.
3. Configure Render `DATABASE_URL` for Supabase (and optional `DATABASE_MIGRATION_URL`), deploy, then check health and logs for sanitized database errors. Ensure the private file volume is mounted and populated before enabling downloads.
4. If checks fail, route traffic back to the original MySQL-backed deployment and restore its file storage. Do not attempt an improvised reverse migration from PostgreSQL; preserve the destination for diagnosis and reconcile any writes made after cutover.
5. Keep the old MySQL database read-only until the migration is accepted and a retention/retirement decision is made.

## Verification limits

The importer compares rows by counts and values on primary-key collisions, checks foreign keys, and prints business-state aggregates. It does not compare a cryptographic whole-database checksum, verify SMTP/M-PESA providers, validate file contents, or prove that every UI workflow works in production. Run the test/build commands in the README and complete the manual checks above. No production source/target credentials are available in this repository session, so no production import or live login was performed here.
