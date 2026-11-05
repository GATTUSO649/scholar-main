# ScholarDesk

ScholarDesk is a student support portal built with TanStack Start, React, Drizzle ORM and PostgreSQL. The server owns all database access. Browser pages use typed server functions; authentication uses random HttpOnly session cookies stored as hashes in PostgreSQL, and each private operation checks the current user's role or ownership on the server.

The public site has separate pages for `/how-it-works`, `/services`, `/library`, `/pricing`, `/faq`, and `/contact`. The legacy `/downloads` address redirects to `/library`.
The administrator workspace includes request and student management, request/revenue summaries, charts, and an in-app notification center. Students receive notifications when administrators update their requests.

## Requirements

- Node.js 24.21 or newer (Node 24)
- PostgreSQL 15 or newer; Supabase PostgreSQL is supported
- npm
- SMTP credentials to send password reset emails
- Persistent private disk storage for uploaded files in production

## Local setup

1. Copy `.env.example` to `.env` and configure `DATABASE_URL` for local PostgreSQL or Supabase. Do not commit `.env`. Supabase connection and Render details are in [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

2. Install, create the PostgreSQL schema, seed the default public catalog, and start:

   ```sh
   npm install
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```

   The initial migration creates the current 16-table application schema. Seeding inserts only the default service catalog and site settings; it creates no accounts.

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

Set `DATABASE_URL` to a reachable PostgreSQL connection string. On Render, use a Supabase session-pooler URL when the direct endpoint is not reachable; production connections use TLS. Optionally set `DATABASE_MIGRATION_URL` for a separate migration role. Review migrations and run `npm run db:migrate` before serving traffic. Set `APP_URL` to the public HTTPS URL. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET` for private document storage. The service role key is server-only and must never be exposed to browser code. Set `ADMIN_SIGNUP_SECRET` to a private random value of at least 32 characters to enable administrator signups. Each signup requires this key; remove it from the server environment to disable further signups. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_SECURE` to enable password reset emails.

Library purchases and quoted service requests use Safaricom Daraja production STK Push. Add these values only in the hosting provider's server-side environment settings:

| Variable | Production value |
| --- | --- |
| `MPESA_ENV` | `production` |
| `MPESA_TRANSACTION_TYPE` | `CustomerBuyGoodsOnline` |
| `MPESA_CONSUMER_KEY` | Consumer Key from the approved Daraja production app |
| `MPESA_CONSUMER_SECRET` | Consumer Secret from the approved Daraja production app |
| `MPESA_SHORTCODE` | Daraja production Store Number for the approved app |
| `MPESA_PASSKEY` | Production Lipa Na M-PESA Online passkey issued for that Store Number |
| `MPESA_CALLBACK_URL` | `https://your-public-domain/api/library/callback` |
| `MPESA_STK_QUERY_ENABLED` | `true` |

The production client calls `https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials`, `https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest`, and `https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query`. It uses `MPESA_SHORTCODE` as Daraja's `BusinessShortCode` and password shortcode, and the Till configured in **Admin → Business settings** as `PartyB`, with `CustomerBuyGoodsOnline`; it does not support PayBill or silently fall back to sandbox. The production Daraja app and passkey must match the Store Number, and Safaricom must enable the destination Till for STK Push. The callback must be publicly reachable over HTTPS and handles both library and service-request payments. Apply the reviewed active PostgreSQL migrations before accepting payments. Students see the destination Till before initiating checkout. Unresolved STK prompts expire after 60 seconds and become retryable. Library resources remain free until an administrator sets a whole-KES price, up to KES 150,000. Service-request checkout is enabled only for an active quoted request in KES. Payment status is set by successful Safaricom STK Query verification, not by an admin form; service delivery files remain unavailable to students until the request is verified as paid.

Administrators manage public service offers and starting prices from **Admin → Public pricing**, then receive new requests in the request queue. They can set the request quote and status and post milestone notes; students see those milestones in the request timeline and receive notifications. A quote must be awaiting payment, in progress, or completed before M-PESA checkout is available.

Never expose or commit the Consumer Secret or Passkey. Do not configure real payment secrets in browser code, logs, local demo environments, or public source control. The provider blueprint declares production mode and prompts for secrets; for an existing Render service, add the values in its Environment settings. A production code configuration is not proof that the service is activated: Safaricom must approve the production app/Till, the host and database must be configured, and a genuine payment must be verified before claiming live operation. This project has not performed that live verification.

Run `npm run db:check` to execute `SELECT 1` against the configured database. The command prints the selected database and a sanitized error code only; it never prints credentials.

### Render

`render.yaml` defines the Node runtime, npm build, Nitro start command, and health check; no Render disk is required. Database migrations are a manual, reviewed deployment step. Deploy it as a Render Blueprint, or copy its settings into an existing dashboard-created service; pushing this file alone does not change that service's settings. Render hosts the app; Supabase hosts PostgreSQL and private file objects. Set `DATABASE_URL`, optional `DATABASE_MIGRATION_URL`, `APP_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` in the service environment. The configured bucket defaults to `private-uploads` and must be private. Configure SMTP credentials for password reset emails. Uploaded files are streamed only through authenticated server routes.

Upload limits are configurable with `REQUEST_MAX_FILE_BYTES`, `REQUEST_MAX_TOTAL_BYTES`, `DOCUMENT_MAX_FILE_BYTES`, and `DOCUMENT_MAX_TOTAL_BYTES`. The document manager accepts PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, and TXT files. Keep the Render disk mounted and include its contents in backups.

### Railway

`railway.json` configures the npm production build and starts the Nitro Node server. Database migrations are a manual, reviewed deployment step. Configure `DATABASE_URL` with the PostgreSQL connection URL, `APP_URL` with the deployed HTTPS domain, SMTP variables, and the same server-only Supabase Storage variables used for Render.

To test from Railway's app service shell, run `npm run db:check`; to create/update tables, run `npm run db:migrate` (also configured as the pre-deploy command). Keep `.env` local and set deployment values in Railway Variables.

No platform disk is required for file storage when using the private Supabase Storage bucket.

## Data and access

- `users`, `profiles`, `user_roles`, and `sessions` hold accounts and roles. Students can update their profile, change a password after verifying their current password, and reset a forgotten password by email.
- Student registration creates the account, then returns to sign-in; students log in before entering the portal.
- `services`, `requests`, `request_updates`, `request_files`, `library_resources`, `library_purchases`, `notifications`, and `site_settings` hold application data. Library purchase records belong to a student and resource, retain the paid amount/currency and M-Pesa receipt, and grant file access only when their status is paid. New requests and student file uploads notify administrators; status, quote, payment, feedback, and delivery changes notify the owning student. The notification bell refreshes every five seconds and refreshes the related request views when a new event arrives. Notifications are private to the signed-in account and can be marked read in the header.
- Administrators manage documents from **Library** in the admin workspace, including categories, descriptions, replacements, and existing whole-KES prices. Students use the protected `/portal/library` page to search, preview PDFs, purchase, and download authorized resources; visitors can browse the separate public `/library` catalog (`/downloads` remains a redirect for older links). Paid files are never returned until a matching purchase is confirmed server-side. Request and library file downloads are streamed through the application after server-side authorization; back up the persistent `FILE_STORAGE_DIR` alongside PostgreSQL.
- KES is the standard currency for new quotes. Existing quotes and paid totals retain their saved currency; changing an existing request to KES does not automatically convert its amount. The admin dashboard shows paid totals grouped by currency, request workload, six-month request volume, students, and deadlines.
- The service catalog includes Microsoft Word, Excel, PowerPoint, Outlook, Teams, OneDrive, OneNote, Forms, SharePoint, Access and Microsoft 365 setup/support, alongside academic proofreading, project and research support.
- Student request/file ownership and administrator access are checked in server-only handlers; never expose database credentials or the Supabase service role key to browser code. PostgreSQL stores file metadata and Supabase Storage stores private file bytes; back up both separately.
- Student sign-in accepts student accounts only; accounts with the administrator role must use the separate admin sign-in page. Changing a password signs out other active sessions.
- Administrator signup requires the server-only `ADMIN_SIGNUP_SECRET`; admin sign-in verifies each account's database-backed admin role.
- Administrator login and every admin operation require the `admin` entry in `user_roles`; ordinary student registrations cannot enter the admin workspace. Only administrators can manage library resources or request statuses. New requests display as **Received**; administrators can move them to **Declined** or **Cancelled**, and students receive a notification when the status changes.
- Request file downloads require a valid session and request ownership or an administrator role. Request uploads are limited by the configured request limits. Library uploads are administrator-only and limited by the configured document limits; accepted formats are PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, and TXT.

Use `npm run db:generate` after changing the Drizzle schema, then review the PostgreSQL SQL before applying it with `npm run db:migrate`. Active migrations are in `drizzle/migrations/`. Archived MySQL migrations remain under `drizzle/mysql-migrations/` for historical reference only and must not be executed against PostgreSQL. MySQL import tooling has been removed; the application and its database scripts use PostgreSQL. See [DATABASE_BACKUP_AND_RESTORE.md](DATABASE_BACKUP_AND_RESTORE.md) for backup and recovery.

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
