# ScholarDesk

ScholarDesk is a student support portal built with TanStack Start, React, Drizzle ORM and MySQL. The server owns all database access. Browser pages use typed server functions; authentication uses random HttpOnly session cookies stored as hashes in MySQL, and each private operation checks the current user's role or ownership on the server.

## Requirements

- Node.js 20.18 or newer
- MySQL 8.0 or newer
- npm
- SMTP credentials to send password reset emails
- Persistent private disk storage for uploaded files in production

## Local setup

1. In MySQL Workbench, connect to the local server at `localhost:3306` as `root` (leave the password blank only if your local MySQL root account has no password). Open a SQL tab and run:

   ```sql
   CREATE DATABASE IF NOT EXISTS scholar_desk
     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

   Refresh the Workbench **Schemas** panel; `scholar_desk` should appear. This project workspace is configured to connect to that schema as `root` with no password via `mysql://root@127.0.0.1:3306/scholar_desk`. A blank root password is for local development only; use a dedicated, password-protected database account outside localhost.

2. The local `.env` is already configured for the blank-password localhost connection. For another setup, copy `.env.example` to `.env` and update `MYSQL_URL`, `APP_URL`, `FILE_STORAGE_DIR`, and SMTP settings. Do not commit `.env`.

3. Install, create the application tables, seed, and start:

   ```sh
   npm install
   npm run db:migrate
   npm run dev
   ```

   The initial migration creates the tables and public support-service catalog.

4. Register an account in the app and grant it administrator access:

   ```sh
   npm run db:promote-admin -- your-address@example.com
   ```

   Sign out and back in after promoting the account.

## Production

This project builds a Node server with Nitro. It does not need a `server.js` file:

```sh
npm run build
npm start
```

Set `MYSQL_URL` to a reachable MySQL 8+ database connection string. Run `npm run db:migrate` once against that database before serving traffic. Set `APP_URL` to the public HTTPS URL. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_SECURE` to enable password reset emails. `FILE_STORAGE_DIR` must point to persistent private storage; back it up with the database. Use TLS for MySQL and HTTPS for the site.

### Render

`render.yaml` defines the Node runtime, npm build, Nitro start command, health check, database migration, and persistent upload disk. Deploy it as a Render Blueprint, or copy its settings into an existing dashboard-created service; pushing this file alone does not change that service's settings. Render does not provide a managed MySQL database, so use an external MySQL 8+ provider. Set `MYSQL_URL` and `APP_URL` in the service's Environment settings, and configure the SMTP credentials for password reset emails. The Blueprint's persistent disk and paid web service plan incur Render charges.

### Railway

`railway.json` configures the npm production build, runs `npm run db:migrate` before each deploy, and starts the Nitro Node server. Set the production `MYSQL_URL`, `APP_URL`, and SMTP variables in the Railway service's Variables settings. The app accepts Railway's split `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, and `MYSQLDATABASE` variables if `MYSQL_URL` is unset. For local migrations, use Railway's public database URL; private Railway hostnames resolve only from services in the Railway network.

Attach a persistent Railway volume mounted at `/data`, then set `FILE_STORAGE_DIR=/data/uploads` so uploaded files survive deployments.

## Data and access

- `users`, `profiles`, `user_roles`, and `sessions` hold accounts and roles.
- `services`, `requests`, `request_updates`, `request_files`, and `site_settings` hold application data.
- Student request/file ownership and administrator access are checked in server-only handlers; never expose the MySQL URL or database credentials to browser code.
- File downloads require a valid session and request ownership or an administrator role. Uploads are limited to 20 MB per file and 50 MB per request.

Use `npm run db:generate` after changing the Drizzle schema, then review the generated SQL before applying it with `npm run db:migrate`.

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
