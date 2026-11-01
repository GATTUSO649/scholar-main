# Security Remediation Checklist

Audit scope: repository source, server functions and API routes, auth/session code, PostgreSQL schema and active migrations, archived MySQL migrations, file handling, payment callbacks, deployment configuration, dependency audit, and available tests. No penetration test or production exploit testing was performed.

## Technologies and Dependency Baseline

- Runtime: Node.js 24; Render pins 24.21.0. Local verification used Node 24.22.1 and npm 11.19.1.
- Framework: TanStack Start/Router, React 19, Vite 8, Nitro, TypeScript, Drizzle ORM with PostgreSQL/Supabase, Nodemailer, and M-Pesa Daraja.
- Deployment/package managers: Render and Railway configuration both use npm (`npm ci`); npm and Bun lockfiles already existed. No Dockerfile, Compose file, GitHub workflow, `.nvmrc`, or `.node-version` existed at baseline. Added GitHub Actions/Dependabot and declared Node `>=24.21.0 <25`.
- Patched direct versions: Vite 8.3.5, Nodemailer 10.2.1, Zod 4.6.7. A root `esbuild` override pins all transitive copies to 0.28.2 because Drizzle Kit 0.31.11 still carries `@esbuild-kit` and esbuild 0.18.x transitively.
- `npm outdated` listed 28 direct packages with newer versions available. No additional upgrades were made where the update was non-security-related or crossed a major version; the full audit is clean.

## Critical

- [ ] None confirmed in the reviewed code.

## High

- [ ] **Rotate exposed credentials.** `.env` was present in reachable Git history and was later deleted. The current `.env` is ignored, but history and prior conversation exposure mean database, Brevo SMTP, and admin-signup credentials should be rotated by the owner. Do not rewrite published history without an approved repository-history plan.
- [ ] **Complete and verify production Supabase cutover.** PostgreSQL TLS is enabled by the runtime, and Render now uses `DATABASE_URL` with optional `DATABASE_MIGRATION_URL`; production credentials, a least-privilege runtime role, migration privileges, network access, and actual cutover still require owner-side verification. The MySQL source URL is migration-only and must not be configured on Render.
- [x] **Dependency advisories remediated.** Baseline findings included Nodemailer GHSA-8c8m-p3m8-cjg8, GHSA-m943-m63m-w62w, and GHSA-85x2-q946-cp5h (recipient parsing; fixed in 10.1.4+), Zod GHSA-mrhx-c7xc-m3w5 (oversized validation workload; fixed in 4.6.6+), multiple Vite advisories including high GHSA-587h-7wmj-h5pm (fixed in 8.3.5), and esbuild GHSA-67mh-4wv8-2f99 (fixed above 0.24.2). Upgraded Nodemailer to 10.2.1, Zod to 4.6.7, Vite to 8.3.5, and overrode nested esbuild to 0.28.2. Current full `npm audit` reports zero vulnerabilities. Tests/build pass with the override, `npm ls esbuild --all` shows only 0.28.2, and Drizzle Kit CLI starts successfully.

## Medium

- [x] **Prevent password-reset account enumeration.** Reset and verification requests now return one shared response for unknown accounts, verified accounts, rate-limited requests, and delivery outcomes.
- [x] **Rate-limit sensitive email workflows.** Password-reset and verification/resend paths now use hashed account keys with a database-backed limit of three requests per 15 minutes. IP-based limits remain unavailable until a trusted proxy/client-IP policy or shared limiter is configured.
- [x] **Make authentication throttles concurrency-safe.** Login and email-request counters use atomic PostgreSQL upserts so concurrent requests cannot overwrite increments.
- [x] **Bound multipart bodies before parsing.** Both file endpoints now count streamed request bytes before calling `formData()`, with regression coverage for chunked bodies lacking `Content-Length`.
- [x] **Reduce sensitive error logging.** Production exception logging now omits raw messages/stacks and sign-in logs no longer emit SQL/parameters. Some SMTP logs still include bounded operational metadata only.
- [ ] **Review paginated reads.** Several admin and student list queries return all matching records without pagination or a maximum result count.
- [ ] **Add security audit events for privileged actions.** Admin role changes and sensitive admin changes are not consistently persisted to an append-only audit log.
- [x] **Validate library upload signatures.** PDF, legacy Word, ZIP-based Office/EPUB, and UTF-8 text uploads are checked against their expected content signatures before storage. Request uploads intentionally accept broader document types and rely on private storage, forced download, and `nosniff`.
- [ ] **Reassess verification policy.** Email verification is disabled unless `REQUIRE_EMAIL_VERIFICATION=true`; it was explicitly turned off during sign-in troubleshooting. Keep it disabled until production email is verified, then decide whether to enforce verification.

## Low / Informational

- [ ] **Complete CSP policy.** Current headers set `frame-ancestors`, `base-uri`, and `object-src`, but no default/script/style directives. The chart component uses `dangerouslySetInnerHTML`; no application usages of `ChartContainer` were found in the source scan.
- [x] Same-origin checks are present on mutation server functions and file/library mutation routes; CSRF middleware is enabled for server functions.
- [x] Session cookies are HttpOnly, SameSite=Lax, Secure in production; session tokens are random and only hashes are stored.
- [x] Core private request/file reads derive identity from the server session and check ownership/admin role. Paid library downloads check purchase ownership.
- [x] Passwords use salted scrypt; reset and verification tokens are cryptographically random, hash-stored, expire, and are invalidated after use.
- [x] SQL access is through Drizzle parameterization except fixed internal SQL expressions; upload storage keys are generated UUIDs and checked before filesystem access.
- [x] M-Pesa callback handling re-queries provider status before marking a purchase paid; callback payload alone is not trusted as proof of payment.
- [x] `.env` patterns are ignored and `.env.example` contains placeholders. No tracked environment file is present in the current tree.
- [x] Runtime requirement declares Node `>=24.21.0 <25`; Render pins Node 24.21.0 and local verification ran on Node 24.22.1.
- [x] GitHub Actions workflow runs install, moderate-level audit, tests, lint, and build on pull requests, main pushes, and weekly schedule. Dependabot is configured for npm and GitHub Actions.

## Verification State

- [x] Production and full dependency audit: 0 vulnerabilities after the esbuild override.
- [x] Regression tests cover shared email-request responses, production-safe errors, bounded multipart parsing, and library upload signatures.
- [x] `npm test`: 69 tests passed.
- [x] `npm run lint`: 0 errors; 7 pre-existing React Fast Refresh warnings remain.
- [x] `npm run build`: passed with Vite 8.3.5.
- [x] `npx tsc --noEmit`: passed.
- [x] `npm run db:migrate`: passed against Supabase; 16 application tables and 2 migrations verified.
- [x] `npm ci --dry-run`: passed with repository `.npmrc` (`legacy-peer-deps=true`).
- [x] Render uses npm with `npm ci`; npm and Bun lockfiles already existed. npm lock regenerated with npm 10 and peer-mode enabled; Bun lock remains synchronized.
- [ ] Verify Render's configured database URL, TLS behavior, SMTP settings, and least-privilege DB user in the dashboard without sharing secrets.
- [ ] Enable GitHub secret scanning and CodeQL/code scanning in repository settings if available for the account/plan; no local `gitleaks`, OSV-Scanner, or Semgrep executable was installed.