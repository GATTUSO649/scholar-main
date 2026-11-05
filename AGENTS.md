<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Architecture rules

- PostgreSQL is the sole application database. Use Drizzle ORM from server-only modules and never connect to the database from browser code.
- Authentication uses opaque, HttpOnly, SameSite cookies backed by PostgreSQL sessions. Every private query and mutation must derive the account from the server session; never trust a client-supplied user ID.
- Authorization is enforced in server-side data functions. `user_roles` is the single source of truth for admin access; students may only access their own requests and files.
- Uploaded files are private and must be served only after server-side ownership/admin checks. File bytes stay outside the public web root. Production uses a private Supabase Storage bucket through server-only credentials; local development defaults to `data/uploads`.
- Keep authenticated pages under `src/routes/_authenticated/` with the shared sidebar shell; admin pages also use `AdminGate` for user experience, in addition to server authorization.
