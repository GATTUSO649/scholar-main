# Security Remediation Checklist

Audit scope: repository source, server functions and API routes, auth/session code, MySQL schema and migrations, file handling, payment callbacks, deployment configuration, dependency audit, and available tests. No penetration test or production exploit testing was performed.

## Critical

- [ ] None confirmed in the reviewed code.

## High

- [ ] **Rotate exposed credentials.** `.env` was present in reachable Git history and was later deleted. The current `.env` is ignored, but history and prior conversation exposure mean database, Brevo SMTP, and admin-signup credentials should be rotated by the owner. Do not rewrite published history without an approved repository-history plan.
- [ ] **Encrypt and verify Railway MySQL transport.** The configured connection negotiated no TLS cipher; a TLS connection with certificate verification failed. `database.server.ts` currently creates a MySQL pool without TLS options. Railway documents encrypted private networking for Railway-to-Railway traffic; Render-to-Railway needs a verified-TLS-capable endpoint or approved private connectivity. Never disable certificate verification.
- [ ] **Replace the root runtime database account.** The configured principal is `root@%` with global privileges and `WITH GRANT OPTION`. Render now declares `MYSQL_MIGRATION_URL` separately; create a least-privilege app account for `MYSQL_URL` and a distinct, restricted migration account for `MYSQL_MIGRATION_URL`, then configure both in Render. Do not paste either URL into chat.
- [ ] **Remediate remaining development dependency advisories.** Nodemailer 10.2.1, Zod 4.6.7, and Vite 8.3.5 are patched. `npm audit --omit=dev` reports zero vulnerabilities. Full `npm audit` still reports four moderate advisories through Drizzle Kit's nested `@esbuild-kit/core-utils` / esbuild chain; `npm audit fix` cannot resolve these non-forced. Assess a Drizzle Kit replacement/upgrade separately.

## Medium

- [x] **Prevent password-reset account enumeration.** Reset and verification requests now return one shared response for unknown accounts, verified accounts, rate-limited requests, and delivery outcomes.
- [x] **Rate-limit sensitive email workflows.** Password-reset and verification/resend paths now use hashed account keys with a database-backed limit of three requests per 15 minutes. IP-based limits remain unavailable until a trusted proxy/client-IP policy or shared limiter is configured.
- [x] **Bound multipart bodies before parsing.** Both file endpoints now count streamed request bytes before calling `formData()`, with regression coverage for chunked bodies lacking `Content-Length`.
- [x] **Reduce sensitive error logging.** Production exception logging now omits raw messages/stacks and sign-in logs no longer emit SQL/parameters. Some SMTP logs still include bounded operational metadata only.
- [ ] **Review paginated reads.** Several admin and student list queries return all matching records without pagination or a maximum result count.
- [ ] **Add security audit events for privileged actions.** Admin role changes and sensitive admin changes are not consistently persisted to an append-only audit log.
- [ ] **Validate uploaded file signatures.** Library extensions are allowlisted, but content signatures are not checked. Request uploads intentionally accept broader document types and rely on private storage, forced download, and `nosniff`.
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

## Verification State

- [x] Production dependency audit: 0 vulnerabilities. Full dependency audit: 4 moderate dev/tooling advisories remain, 0 high, 0 critical.
- [x] Regression tests added for shared email-request response, production-safe errors, and bounded multipart parsing.
- [x] `npm test`: 49 tests passed after remediation and dependency upgrades.
- [x] `npm run lint`: 0 errors; 7 pre-existing React Fast Refresh warnings remain.
- [x] `npm run build`: passed with Vite 8.3.5.
- [x] `npm ci --dry-run`: passed with repository `.npmrc` (`legacy-peer-deps=true`).
- [x] Render's `npm ci` path uses the matching `.npmrc`; the lockfile was regenerated with npm 10 and peer-mode enabled.
- [ ] Verify Render's configured database URL, TLS behavior, SMTP settings, and least-privilege DB user in the dashboard without sharing secrets.