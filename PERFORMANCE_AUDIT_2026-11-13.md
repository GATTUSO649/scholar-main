# ScholarDesk Performance Audit — 2026-11-13

## Executive Summary

ScholarDesk is a TanStack Start/React 19 application with file-based TanStack Router routes, React Query, Drizzle/PostgreSQL, and a Node/Nitro server deployed to Render. The repository description mentioning Express does not match the runtime implementation: `src/server.ts` delegates requests to the TanStack Start server entry, and `scripts/server.js` starts the Node server.

The routing framework already emits route-specific browser chunks, preloads on intent, and restores scroll. The clearest confirmed issues are a lazy-loaded above-the-fold homepage image, an artificial below-fold spinner around static content that does not split its JavaScript, a sequential public-header user/admin check, five-second polling of an unbounded deliveries query, and several unbounded roster/request queries whose filtering and summaries run in the browser. The root has no route-state progress indicator. Protected routes do enforce server authorization, but the authenticated parent disables SSR, so anonymous deep links initially receive a client shell and redirect after hydration.

No destructive operations, database migrations, or deployment were performed for this audit. The worktree was clean when inspection began.

## Architecture and Scope

- 44 file routes are registered by generated `src/routeTree.gen.ts`; do not edit the generated file manually.
- TanStack Router uses `defaultPreload: "intent"`, scroll restoration, and a 30-second preload freshness window.
- React Query is the shared cache. Its configured defaults are 30 seconds stale, five-minute garbage collection, one retry, and no focus refetch; payment ledgers and notifications override freshness intentionally.
- Authenticated pages share `src/routes/_authenticated/route.tsx`. Its `beforeLoad` calls the server-side current-user/role check, while `ssr: false` moves the initial protected-route decision to the browser.
- Server handlers and server functions use Drizzle over PostgreSQL. Render and Railway both start the Node server; the repository's deployment configs specify Render Node 24.22.1 and a 0.5 CPU / 512 MB instance.
- Supabase Storage is private and accessed through server-only service-role credentials. Local development uses a private `data/uploads` directory.
- Existing modules include dashboard, profile, requests, deliveries, request details, support, library, student roster, admin request queue, payments, pricing, content, and legal documents. Separate course, assignment, or examination-result route modules were not found.

## Production Measurements

Measurements below are single live Render samples from 2026-11-13, not a statistically controlled benchmark. They must not be interpreted as guarantees or as measurements under slow-network throttling.

| Scenario | Measurement |
| --- | ---: |
| Homepage document TTFB | 856 ms |
| Homepage DOMContentLoaded | 1,940 ms |
| Homepage first contentful paint | 2,304 ms |
| Homepage load event | 2,621 ms |
| Homepage same-origin transferred resources | 414,373 bytes |
| `/services`, 390 × 844 direct load TTFB | 332 ms |
| `/services`, 390 × 844 DOMContentLoaded | 521 ms |
| `/services`, 390 × 844 first contentful paint | 648 ms |
| `/services` critical service/resource data ready | 1,549 ms |
| Warm desktop SPA navigation to `/services` | 273 ms |
| Browser back to homepage | 26 ms |
| Mobile menu navigation to `/services` | 162 ms |

A previous repository audit measured `/services` at 2.84 seconds in a separate run. That historical sample and this run are not directly comparable because browser state, warm/cold cache, viewport, and timing endpoints differ.

LCP, INP, CLS, slow-network performance, authenticated route timing, database query durations/plans, and private-file transfer time were not available from this audit. No values are inferred for them. The current local production output has a largest browser entry chunk of 369,078 bytes, a stylesheet of 112,621 bytes, and a homepage JPEG of 198,677 bytes; these are raw asset sizes, not gzip-transfer or Core Web Vitals measurements.

## Findings

### High: Critical homepage image is lazy-loaded

`src/routes/index.tsx` marks the main hero image `loading="lazy"` despite it being a first-viewport asset. Its dimensions are present, which helps layout stability, but lazy loading can delay the largest visible image and likely LCP. The image is about 199 KB in the current build. It should be eager/high-priority; below-the-fold media should remain lazy.

### High: Public header performs a user/admin request waterfall

`SiteHeader` calls `useUser()` and only enables `useIsAdmin(user?.id)` after the user request returns. These hooks call separate server functions, so logged-in visitors can wait for a second request to determine the account button state. The authenticated route already uses a combined `getCurrentUserStateFn` that returns the user and admin status together. This is safe to deduplicate through a shared non-persistent query; server authorization must remain authoritative.

### High: Deliveries poll all matching rows every five seconds

`src/routes/_authenticated/deliveries.tsx` sets `refetchInterval: 5_000` and `staleTime: 0`. Each active student page repeatedly runs `getMyDeliveries()`, which joins every completed paid delivery and file for that student. This can create 12 requests per minute per open tab and the query is not bounded. Notifications also poll every 30 seconds when closed and every five seconds when open; this is less severe and user-visible while open.

### High at scale: request/student lists are unbounded

`getMyRequests`, `getAdminRequests`, and `getAdminStudents` return every matching row. The student roster search, admin queue filters and counts, and CSV export then run on the client. This increases database work, response bytes, browser memory, and rendering as data grows. The admin queue also depends on full-result summaries and full filtered CSV export, so pagination needs a deliberate API/UI contract rather than a silent row limit. The current request index covers student/created ordering and status; a production query plan and row cardinality were not available, so no index change is justified yet.

### Medium: authenticated deep links wait for client hydration

The authenticated parent uses `ssr: false`. Live checks confirmed unauthenticated `/dashboard` redirects to `/auth` and `/admin/dashboard` redirects to `/admin/login` after client hydration, so authorization remains effective. The initial server response is nevertheless the generic shell rather than the destination/redirect, delaying direct-link feedback. Enabling SSR without a session-cookie and data-hydration review could expose private state, so this needs a security-aware design.

### Medium: `LazySection` delays visible content but does not split code

The homepage testimonials are imported and included in the route chunk, then rendered behind an `IntersectionObserver` placeholder labeled “Loading stories.” It does not reduce initial JavaScript download or split the component; it adds a spinner until the section nears the viewport. Native `content-visibility` with an intrinsic size is a better fit for this static below-fold section. The reusable `LazySection` has only one call site.

### Medium: no navigation-specific progress signal or reduced-motion policy

The root wraps the route outlet in a generic full-screen Suspense loader, but there is no lightweight indicator tied to TanStack Router's actual `isLoading` state. Query-backed routes instead show local text/placeholders, which is good progressive rendering. Homepage motion uses blob, marquee, float, and rise animations; no `prefers-reduced-motion` rules were found.

### Medium: private file loading buffers the complete file

`openFile()` shows a toast until `fetch()` and `response.blob()` finish, then creates an object URL. `/api/files` enforces authorization before the private Storage read, sets `private, no-store`, and returns an attachment. This is correct for privacy but buffers the file in the Node server and browser before download, so memory and perceived latency scale with file size. Request uploads are capped at 20 MB per file and 50 MB total; library files have a separate 25 MB per-file cap.

The live unauthenticated `/api/files?key=<UUID>` probe returned 401 with “You must be signed in,” not 500. Existing automated tests cover private authorization, valid local/Supabase downloads, missing objects, invalid storage credentials, transient storage retries, and cleanup. The historical authenticated production 500 cannot be reproduced without an authorized test file/account or Render logs; no credentials or private content were accessed. Current handler behavior logs a sanitized stage and returns a safe 503 for Supabase errors, 404 for missing objects, and 500 for unclassified database/server failures.

### Low: external fonts and animation costs

The root loads Google Fonts via a stylesheet request. Font preconnects are present. The hero image has explicit dimensions, avoiding its intrinsic layout shift, but the current animation system has no reduced-motion override. The chart wrapper under `src/components/ui/chart.tsx` has no imports elsewhere; its Recharts dependency is tree-shaken from the current browser entry and does not contribute to measured initial transfer. It is dormant UI code, not a runtime trace.

## Navigation and Route Smoke Tests

- Direct navigation returned HTTP 200 for `/`, `/how-it-works`, `/services`, `/library`, `/pricing`, `/faq`, `/contact`, `/auth`, `/admin/login`, `/reset-password`, and `/verify-email`.
- `/downloads` redirected to `/library`.
- Unauthenticated `/dashboard` redirected to `/auth`; `/admin/dashboard` redirected to `/admin/login`.
- A deliberately missing route returned HTTP 404 and rendered the 404 page.
- Desktop and mobile menu navigation reached `/services`; measured warm click times were 273 ms and 162 ms respectively. Browser back took 26 ms.
- These checks do not cover every authenticated screen, payment flow, upload flow, or browser failure state. No production login was attempted.

## Trace and Dead-Code Review

- No trace-named files, `performance.mark`/`measure`, `PerformanceObserver` instrumentation, `console.debug`, debugger statements, or OpenTelemetry/Sentry traces were found in application source.
- The only `console.info` calls are successful SMTP acceptance and successful Supabase Storage requests. They are operational records rather than stale trace files; failure diagnostics are sanitized and should be retained. Successful Storage logs include timing and retry data, so removing them would reduce production observability.
- The unused Recharts wrapper is not present in the browser bundle. Removing it would not improve current page-load bytes; leave it unless the project wants explicit dead-code cleanup.

## Prioritized Implementation Plan

1. Fix the measured hero-image priority and remove the misleading static-section loader without introducing delays.
2. Add a thin indeterminate top bar driven directly by Router `isLoading`; retain local data placeholders for queries.
3. Deduplicate public header user/admin state through the combined session query, preserving server authorization and session-change clearing.
4. Reduce deliveries polling frequency and avoid unnecessary repeat fetching while preserving fresh delivery updates on focus/manual refresh.
5. Add `prefers-reduced-motion` handling and keep animations inexpensive on mobile.
6. Leave unbounded request/student list redesign and database indexes for a separate, tested pagination/export change; do not silently truncate records or migrate production schema.
7. Investigate authenticated `/api/files` 500 only with a test account or sanitized Render logs; do not expose credentials or weaken ownership checks.

## Audit Limitations

The deployed production database was not queried, no private document was fetched, and no Render logs or credentials were accessed. Database `EXPLAIN (ANALYZE)`, table cardinalities, private-file timing, authenticated end-to-end flows, and statistically repeated/slow-network measurements remain unavailable. No deployment, production migration, or destructive operation was performed.

## Implementation and Verification

Changes made after the audit:

- `src/routes/__root.tsx` now shows an indeterminate top bar while TanStack Router is loading or any initial React Query is pending. Background refetches are excluded; it hides when the work completes or errors.
- `src/routes/index.tsx` requests the above-fold hero image eagerly at high priority. Testimonials render directly instead of showing a fake intersection-observer loader; the unused `src/components/LazySection.tsx` was removed.
- `src/styles.css` honors `prefers-reduced-motion` for the progress indicator, spinners, transitions, and existing animations.
- `src/lib/auth.ts`, auth routes, and `src/lib/backend.ts` use the combined current-user/admin session state. The public header no longer waits for a second role request, login checks avoid the prior sequential user/role lookup, obsolete server-function wrappers and cache writes were removed, and the non-persistent query cache is still cleared on session changes.
- `src/routes/_authenticated/deliveries.tsx` now refreshes every 30 seconds instead of every 5 seconds and refreshes on focus. `src/components/NotificationBell.tsx` uses client-side routing for internal destinations.
- No database schema, production secrets, or file-ownership rules were changed. The unbounded admin/student/request lists remain a known scale issue; paginating them requires a separate UI/export contract change.

Verification after changes:

- `npm test`: 153 tests passed across 18 files.
- `npm run lint`: zero errors; seven existing Fast Refresh warnings remain.
- `npm run build`: Vite and Nitro builds succeeded.
- Local browser check at `http://localhost:8082`: a mobile navigation reached `/services` in 220 ms. With service/resource queries pending, the progress bar was visible; it disappeared after both queries completed. The homepage hero reports `loading="eager"` and `fetchpriority="high"`.
- Local development `/services` data-ready time was 6.31 s on a cold run and 3.96 s during a later cold SPA navigation. These include Vite development startup and local `.env` database latency, so they are not comparable with the 1.55 s warmed production sample above.
- Largest browser entry changed from 369,078 to 369,723 bytes; CSS from 112,621 to 113,247 bytes. This small increase is the global progress indicator and reduced-motion styles; no browser bundle-size reduction is claimed.
- `git diff --check` passed. No deployment or production migration was performed.

## Remaining Work

- Repeat production timings after an approved deployment. LCP, INP, CLS, slow-network results, and statistically meaningful before/after comparisons remain unavailable.
- Verify authenticated navigation and `/api/files` with an authorized test account. The anonymous production file probe returned the expected 401; the historical authenticated 500 could not be reproduced without private file access or Render logs.
- Add SQL-side filtering/pagination and summary queries for the unbounded request and student lists while preserving full filtered exports. Obtain production-safe query plans and row counts before changing indexes.
- Measure storage download size/latency and memory under realistic concurrency. The current authorized download buffers file bytes in the application and browser.
- No stale performance trace files or instrumentation were found. Success/failure storage and SMTP logs are retained as operational diagnostics; unused auth wrappers/cache writes and the fake `LazySection` loader were removed.
