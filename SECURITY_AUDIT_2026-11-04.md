# ScholarDesk Security Audit — 2026-11-04

## Scope and Method

Reviewed authentication/session code, all five direct API route modules, server-function validators, PostgreSQL schema and active migrations, payment reconciliation, file handling, security headers, error logging, dependency status, deployment configuration, and relevant unit tests. Testing was limited to local code and static inspection; no production requests, credential use, destructive operations, or penetration tests were performed. This is a code/configuration review, not an ASVS certification.

## Executive Summary

No confirmed authentication bypass, student-to-student IDOR, SQL injection, client-controlled paid state, or M-PESA callback-only payment authorization was found in the inspected paths. PostgreSQL access is server-side through Drizzle; no Supabase browser client or RLS policies were found in the repository. Same-origin checks and TanStack Start CSRF middleware are enabled for mutations.

Confirmed security work included an unbounded JSON body parse in the library metadata PATCH endpoint; this is now bounded locally. File authorization and idempotent metadata operations also retry once on known transient database connection errors. The app still has no trusted-IP login throttling, no fine-grained administrator roles, and no RLS policies in tracked migrations. An append-only administrator audit table and event writes have been implemented with an unapplied migration. Supabase grants/Data API exposure, Render DB-role privileges, and production environment state cannot be verified from this workspace.

The repository notes and the earlier `.env` attachment establish that credentials have been exposed. Rotate them with their providers; `.env` being ignored now does not undo that exposure or remove historical copies.

## Ranked Findings

### High

1. **Previously exposed production credentials — confirmed exposure; owner action required.** Database, SMTP, M-PESA, and administrator-signup credentials were included in prior shared context, and the repository remediation notes state `.env` was reachable in Git history. Do not reuse those values. Rotate/revoke them at the database, mail, Safaricom, and application layers; replace the admin-signup secret; inspect CI/deployment logs and Git hosting secret-scanning results. Do not rewrite published history without an approved plan.

2. **Production Supabase grants/RLS not verified — conditional high impact, not a confirmed exploit.** No RLS policy or `ENABLE ROW LEVEL SECURITY` statement exists in tracked PostgreSQL migrations, and the app itself uses server-only PostgreSQL. If the Supabase Data API grants `anon`/`authenticated` access to these tables, absence of RLS could expose student records or payments through PostgREST. The actual project grants, exposed schemas, and API settings require owner/dashboard verification. Do not enable blanket policies without a table-by-table access design.

### Medium

1. **Unbounded library metadata PATCH body — fixed locally.** `src/routes/api.library.ts` previously called `request.json()` before field-length checks, permitting arbitrary body allocation. It now uses the shared bounded parser with a 16 KB ceiling and returns 400/413. Regression tests verify an oversized body never reaches the admin mutation.

2. **No trusted-IP login rate limit; current login throttle is email-keyed — confirmed gap.** `authenticateAccount` atomically limits attempts by email, which helps online password guessing but allows repeated requests from many sources to lock a known account for the remainder of the window. Registration and administrator signup do not have a shared IP-based limiter. Do not trust arbitrary `X-Forwarded-For`; establish Render's trusted-proxy semantics or configure a shared rate limiter first.

3. **Administrator privileges are not separated — confirmed design gap against requested finance/academic/content separation.** `user_role` contains only `admin` and `student`, and protected operations generally accept any `admin`. Finance, academic operations, content management, and privileged account settings therefore share the same admin authority. Mapping existing administrators to narrower roles requires an owner-approved role matrix and migration; no roles were changed in this audit.

4. **Append-only administrative audit trail — implemented locally; migration not applied.** A new PostgreSQL table, update/delete/truncate guards, and transactional events now cover admin creation/login, business/site settings, FAQ, service/pricing, library, request/delivery, and CLI promotion actions. Events contain actor, action, target, timestamp, and limited metadata (changed field names/status flags), not submitted content, credentials, or payment payloads. Apply the reviewed additive migration before deploying code that writes to this table; set an approved retention policy before production use.

5. **Account/password policy needs an owner decision.** Email verification is optional and environment-controlled. Admin MFA is absent. Current safeguards include scrypt password hashes, opaque hashed session tokens, secure/HttpOnly/SameSite cookies, 8-hour admin sessions, password-reset session invalidation, same-origin mutations, and database-backed email-request throttles. Decide whether production registration requires verified email and what MFA provider/rollout is supported.

### Low / Defense in Depth

1. **CSP is incomplete.** `src/server.ts` sets `frame-ancestors`, `base-uri`, and `object-src`, but has no `default-src`/`script-src`/`style-src`. No exploitable XSS was confirmed. A generic chart component writes CSS using `dangerouslySetInnerHTML`; no application route usage was found. Its CSS keys, values, and selector IDs are now constrained, but Report-Only CSP telemetry and compatibility review remain before enforcement.

2. **Request attachments lack format signature validation and malware scanning.** They are private, bounded (20 MB each/50 MB per request), stored with generated UUID keys, returned as `application/octet-stream` attachments, and use `nosniff`; no inline preview path was found. This is a residual malware/content risk, not a confirmed code-execution vulnerability. Consider an allowlist and scanning process if the service accepts untrusted documents at scale.

3. **Production database least privilege and Supabase exposure need verification.** The app uses direct TLS PostgreSQL connections and parameterized Drizzle queries; local `SELECT 1` passed in a previous iteration. No production connectivity, DB grants, PostgREST policies, backups, or service-role privileges were tested here.

## Verified Controls

- Student request/file access derives identity from the opaque server session and filters by request ownership. Admin authorization checks `user_roles` on the server.
- Paid request delivery requires the owning student's paid status/payment record. Paid library downloads require a matching paid purchase; free resources are intentionally public.
- Request file authorization and idempotent metadata insertion retry once for a limited set of transient PostgreSQL connection errors; storage writes are not retried. Upload failure logs include only the operation stage, database code, and error name.
- M-PESA callback fields are bounded and parsed; callback amount, phone, receipt, transaction date, and merchant/checkout IDs are checked against the stored payment. Provider STK Query is authoritative before paid state is written. Payment rows are locked during transitions; purchase starts serialize on the user/request row. Duplicate callbacks do not independently grant access.
- Zod validators cover server-function inputs; direct JSON payment/callback bodies and multipart bodies have limits. The library upload checks extension and file signatures.
- SQL calls use Drizzle parameterization; raw SQL found in reviewed code is static/internal or parameterized.
- `getSafeReturnTo` rejects cross-origin/auth-loop destinations.
- Current production dependency audit command `npm audit --omit=dev` reported zero vulnerabilities. The earlier remediation report documents a full audit; rerun full audit/CI as part of release verification.
- `.gitignore` excludes `.env` and `.env.*` while allowing `.env.example`; this does not remediate previously exposed secrets.

## Findings Requiring Tests

- BOLA/IDOR across student request IDs and file keys: server-side guards are present, but there is no direct integration test proving an authenticated student cannot fetch another student's request/file.
- Admin/student role escalation across every mutation: helpers are tested, but not every protected server function/API operation is covered by route-level authorization tests.
- Append-only trigger behavior against PostgreSQL; the migration has not been applied to a test database in this workspace.
- Login lockout/rate-limit behavior across concurrent and distributed requests.
- CSP compatibility/report-only telemetry.
- Supabase RLS/grants and production secrets: dashboard/manual verification only.
- Live payment callbacks, provider outages, refunds/reconciliation, and production file access were not exercised.

## Files and Configuration

- Current application data access remains PostgreSQL-only with server-side Drizzle. Generated additive migration `0005_ordinary_lila_cheney.sql` creates the audit table, indexes, and append-only trigger; it has not been applied to any database.
- Existing uncommitted edits before the security review included `src/routes/_authenticated/route.tsx`, `src/routes/api.files.ts`, `src/styles.css`, and an untracked `src/test/file-api.test.ts`. They were preserved and the file API regression fixture was corrected.
- Additional security files changed in this audit include `drizzle/schema.ts`, `src/lib/backend.server.ts`, `src/routes/api.library.ts`, `src/routes/api.files.ts`, `src/components/ui/chart.tsx`, `src/lib/chart-style.ts`, `scripts/promote-admin.mjs`, and security regression tests.
- No production configuration, credentials, database rows, or user files were changed.

## Verification Results

- `npm test`: 94 tests passed across 16 files, including bounded PATCH, upload notification failure, and chart CSS input tests.
- `npx tsc --noEmit`: passed.
- `npm run lint`: 0 errors; 7 existing React Fast Refresh warnings remain.
- Prettier checks on changed TypeScript/Markdown files: passed. The generated SQL was reviewed but not passed through Prettier because no SQL parser is configured.
- `npm audit`: 0 vulnerabilities.
- `npx drizzle-kit check`: migration metadata is consistent.
- `npm run build`: Vite and Nitro succeeded.
- No production migration, authenticated production test, live payment, or external target test was performed.

## Recommended Order

1. Rotate all previously exposed credentials and confirm Render/Supabase uses only replacements.
2. Verify Supabase Data API table grants, exposed schemas, RLS status, and runtime DB role privileges in the project dashboard.
3. Apply migration `0005_ordinary_lila_cheney.sql` to staging, verify append-only behavior, then schedule its production application before deploying audit-writing code.
4. Add route-level student IDOR and admin authorization regression tests.
5. Agree on admin role boundaries and design a separate non-destructive role migration.
6. Configure a trusted proxy/IP rate-limit strategy; do not infer client IP from untrusted headers.
7. Introduce CSP Report-Only and validate frontend compatibility before any enforcement.
8. Re-run full audit/tests/build and verify release behavior in staging before production deployment.
