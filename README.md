# ScholarDesk

ScholarDesk is a student support portal built with TanStack Start, React, Drizzle ORM and MySQL. The server owns all database access. Browser pages use typed server functions; authentication uses random HttpOnly session cookies stored as hashes in MySQL, and each private operation checks the current user's role or ownership on the server.

The public site has separate pages for `/how-it-works`, `/services`, `/library`, `/pricing`, `/faq`, and `/contact`. The legacy `/downloads` address redirects to `/library`.
The administrator workspace includes request and student management, request/revenue summaries, charts, and an in-app notification center. Students receive notifications when administrators update their requests.

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

4. Configure a private random signup key of at least 32 characters in `.env` as `ADMIN_SIGNUP_SECRET`, then visit `/admin/login` and choose **Create admin account**. The key is required for each admin signup. Keep it private; remove it from the server environment to disable further admin signups.

   Alternatively, register a standard account and grant it administrator access:

   ```sh
   npm run db:promote-admin -- your-address@example.com
   ```

   Sign out and back in after promoting the account.

   Admin sign-in is separate from student sign-in. Sign in at `/admin/login` with the administrator account's email and password. After initial setup, new admin accounts must be provisioned by the site owner using the command above.

## Production

This project builds a Node server with Nitro. It does not need a `server.js` file:

```sh
npm run build
npm start
```

Set `MYSQL_URL` to a reachable MySQL 8+ database connection string. Run `npm run db:migrate` once against that database before serving traffic. Set `APP_URL` to the public HTTPS URL. Set `ADMIN_SIGNUP_SECRET` to a private random value of at least 32 characters to enable administrator signups. Each signup requires this key; remove it from the server environment to disable further signups. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_SECURE` to enable password reset emails. `FILE_STORAGE_DIR` must point to persistent private storage; back it up with the database. Use TLS for MySQL and HTTPS for the site.

Library payments use Safaricom Daraja production STK Push with a registered M-PESA Till. Add these values only in the hosting provider's server-side environment settings:

| Variable | Production value |
| --- | --- |
| `MPESA_ENV` | `production` |
| `MPESA_TRANSACTION_TYPE` | `CustomerBuyGoodsOnline` |
| `MPESA_CONSUMER_KEY` | Consumer Key from the approved Daraja production app |
| `MPESA_CONSUMER_SECRET` | Consumer Secret from the approved Daraja production app |
| `MPESA_SHORTCODE` | Registered M-PESA Till Number enabled for online checkout |
| `MPESA_PASSKEY` | Production Lipa Na M-PESA Online passkey issued for the Till |
| `MPESA_CALLBACK_URL` | `https://your-public-domain/api/library/callback` |
| `MPESA_STK_QUERY_ENABLED` | `true` |

The production client calls `https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials`, `https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest`, and `https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query`. It uses the registered Till for both `BusinessShortCode` and `PartyB`, with `CustomerBuyGoodsOnline`; it does not support PayBill or silently fall back to sandbox. The callback must be publicly reachable over HTTPS. Apply migrations `0013_mpesa_production_payments.sql` and `0014_mpesa_payment_expiry.sql` (the deploy pre-command runs migrations) before accepting paid library checkouts. Unresolved STK prompts expire after 60 seconds and become retryable. Existing resources remain free until an administrator sets a whole-KES price, up to KES 150,000. Until all production variables are supplied, paid checkout is unavailable.

Never expose or commit the Consumer Secret or Passkey. Do not configure real payment secrets in browser code, logs, local demo environments, or public source control. The provider blueprint declares production mode and prompts for secrets; for an existing Render service, add the values in its Environment settings. A production code configuration is not proof that the service is activated: Safaricom must approve the production app/Till, the host and database must be configured, and a genuine payment must be verified before claiming live operation. This project has not performed that live verification.

Run `npm run db:check` to execute `SELECT 1` against the configured database. The command prints the selected database and a sanitized error code only; it never prints credentials.

### Render

`render.yaml` defines the Node runtime, npm build, Nitro start command, health check, database migration, and persistent upload disk. Deploy it as a Render Blueprint, or copy its settings into an existing dashboard-created service; pushing this file alone does not change that service's settings. Render does not provide a managed MySQL database, so use an external MySQL 8+ provider. Set `MYSQL_URL` and `APP_URL` in the service's Environment settings, and configure the SMTP credentials for password reset emails. The Blueprint's persistent disk and paid web service plan incur Render charges.

### Railway

`railway.json` configures the npm production build, runs `npm run db:migrate` before each deploy, and starts the Nitro Node server. In the app service's **Variables** tab, use **Add Reference** to set `MYSQL_URL` from the MySQL service's generated `MYSQL_URL`. This is preferable for services in the same Railway environment. Alternatively, the app accepts `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, and `MYSQLDATABASE` if `MYSQL_URL` is unset. Set `APP_URL` to the deployed HTTPS domain, configure the SMTP variables, and set `FILE_STORAGE_DIR` to the mounted persistent volume path.

To test from Railway's app service shell, run `npm run db:check`; to create/update tables, run `npm run db:migrate` (also configured as the pre-deploy command). For connections from outside Railway, check the MySQL service's **Settings → Networking → Public Networking** for the current public host and port. The previously supplied `iriguchi.proxy.rlwy.net:24810` values are not verified here; use them only if Railway currently shows them. Keep `.env` local and set deployment values in Railway Variables.

Attach a persistent Railway volume mounted at `/data`, then set `FILE_STORAGE_DIR=/data/uploads` so uploaded files survive deployments.

## Data and access

- `users`, `profiles`, `user_roles`, and `sessions` hold accounts and roles. Students can update their profile, change a password after verifying their current password, and reset a forgotten password by email.
- Student registration creates the account, then returns to sign-in; students log in before entering the portal.
- `services`, `requests`, `request_updates`, `request_files`, `library_resources`, `library_purchases`, `notifications`, and `site_settings` hold application data. Library purchase records belong to a student and resource, retain the paid amount/currency and M-Pesa receipt, and grant file access only when their status is paid. New requests and student file uploads notify administrators; status, quote, payment, feedback, and delivery changes notify the owning student. The notification bell refreshes every five seconds and refreshes the related request views when a new event arrives. Notifications are private to the signed-in account and can be marked read in the header.
- Administrators manage public novels, business plans, and articles from **Library** in the admin workspace, including whole-KES prices and free items. Students use the protected `/portal/library` page to search, purchase with M-Pesa, and download owned resources; visitors can browse the separate public `/library` catalog (`/downloads` remains a redirect for older links). Paid files are never returned until a matching purchase is confirmed server-side. Library file bytes are stored under the private `FILE_STORAGE_DIR`; downloads are streamed through the application as attachments. Keep this directory on persistent private storage and include it in backups.
- KES is the standard currency for new quotes. Existing quotes and paid totals retain their saved currency; changing an existing request to KES does not automatically convert its amount. The admin dashboard shows paid totals grouped by currency, request workload, six-month request volume, students, and deadlines.
- The service catalog includes Microsoft Word, Excel, PowerPoint, Outlook, Teams, OneDrive, OneNote, Forms, SharePoint, Access and Microsoft 365 setup/support, alongside academic proofreading, project and research support.
- Student request/file ownership and administrator access are checked in server-only handlers; never expose the MySQL URL or database credentials to browser code.
- Student sign-in accepts student accounts only; accounts with the administrator role must use the separate admin sign-in page. Changing a password signs out other active sessions.
- Administrator signup requires the server-only `ADMIN_SIGNUP_SECRET`; admin sign-in verifies each account's database-backed admin role.
- Administrator login and every admin operation require the `admin` entry in `user_roles`; ordinary student registrations cannot enter the admin workspace. Only administrators can manage library resources or request statuses. New requests display as **Received**; administrators can move them to **Declined** or **Cancelled**, and students receive a notification when the status changes.
- Request file downloads require a valid session and request ownership or an administrator role. Request uploads are limited to 20 MB per file and 50 MB per request. Public library uploads are administrator-only, limited to 25 MB, and accept PDF, EPUB, Word, or plain-text files.

Use `npm run db:generate` after changing the Drizzle schema, then review the generated SQL before applying it with `npm run db:migrate`. Migration `0005_productive_star_brand.sql` creates the library table; `0006_notification_schema_integrity.sql` aligns foreign-key collations and ensures the notification/library indexes and constraints exist; `0008_library_pricing_and_purchases.sql` adds library pricing and student purchase records. These migrations do not delete existing records.

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
