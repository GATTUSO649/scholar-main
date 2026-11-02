# Database Backup and Restore

Database backups do not include private uploads. Back up the PostgreSQL database and `FILE_STORAGE_DIR` separately, encrypt both at rest, restrict access, and periodically test restores into a separate database/project.

## PostgreSQL backup

Use a current PostgreSQL client compatible with the Supabase server. Supply the connection URL through a protected environment or a password prompt; do not put credentials in shell history or a committed file.

```sh
pg_dump --format=custom --no-owner --file=scholar-desk.dump "$DATABASE_URL"
```

Verify the archive can be listed:

```sh
pg_restore --list scholar-desk.dump
```

Also retain the reviewed SQL migration files and note the deployed application revision. Keep backups encrypted and outside the public web root.

## Restore to a new/empty database

Create a separate empty PostgreSQL database or Supabase project, set its URL as `RESTORE_DATABASE_URL`, and restore without `--clean` or `--if-exists`:

```sh
pg_restore --dbname="$RESTORE_DATABASE_URL" --no-owner scholar-desk.dump
```

Then run `npm run db:check`, verify representative counts and relationships, and test the application against the restored database before changing production configuration. Do not restore into a populated production database. A restore into an existing database can conflict with objects and records; use a new target and deliberate cutover instead.

## Private upload backup

Stop application writes or take a filesystem-consistent snapshot. Archive the configured `FILE_STORAGE_DIR` including its relative directory structure and file permissions, encrypt it, and record a checksum manifest. Restore it to persistent private storage at the same configured path, then verify every database-referenced storage key resolves to the expected file before enabling downloads. Never place uploads under `public/` or expose the archive over HTTP.

## Retention and recovery drills

Set a retention schedule that meets the organization's recovery objectives, protect backups with least-privilege access, and periodically restore both database and upload files to a non-production environment. Record the restore duration and verify sign-in, role checks, requests, purchases, and file downloads before considering a backup usable. A successful backup command alone is not evidence that recovery works.
