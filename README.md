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

Build and run the Node server output (the database driver and private file storage require a Node runtime):

```sh
npm run build
node .output/server/index.mjs
```

Set the environment variables in the runtime, use TLS for MySQL and the public site, and mount persistent private storage at `FILE_STORAGE_DIR`. Back up the MySQL database and that file directory together. Configure SMTP so account holders can reset their passwords.

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
