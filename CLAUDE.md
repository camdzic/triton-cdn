# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All from the repo root unless noted. Bun workspace (isolated linker); there is no test suite.

| Command | What it does |
| --- | --- |
| `bun run tsc` | `next typegen` for the web app, then `tsc -b --force` over all project references (shared, server, server/scripts, cli, web). `--force` is required: consumers import `@triton/shared` through the workspace, not a project reference (`shared` is `noEmit`, which references reject with TS6310), so incremental `tsc -b` would not recheck them after a contract change. Plain `tsc` at the root checks nothing. A single package: `bun run tsc` inside it (`tsc -p .`). |
| `bun run biome` | Biome check with `--write --unsafe`. Use `bunx biome check` to lint without fixing. The root `biome.json` is the base for everything; `apps/web/biome.json` extends it (`"extends": "//"`) with the React and Next domains and skips shadcn-generated files. |
| `bun run dev` | `wrangler dev` on `:8787` with local D1/R2, loading `.env.development` then `packages/server/.dev.vars`. Serves `apps/web/out` as static assets; `predev` builds it if missing. |
| `bun run dev:web` | `next dev` on `:3000` with live reload; dev-only rewrites proxy `/api/*` and `/<file>` to `TRITON_URL` (the local Worker). |
| `bun run build:web` | Static export of the dashboard to `apps/web/out`, then `scripts/flatten-segments.ts`. Fails with `EBUSY` while `wrangler dev` holds `out/`; stop it first. |
| `bun run cli:dev [cmd]` | CLI from source against the local server; `.env.development` also sets `TRITON_CONFIG_DIR` to `.triton-local` so the production login is untouched. |
| `bun run cli [cmd]` | CLI from source against `TRITON_URL` in `.env`. |
| `bun run build` | Bundles the CLI to `packages/cli/dist/triton.js` with `TRITON_URL` inlined (`--env 'TRITON_*'`, `sharp` external). The linked `triton` command runs this file, so rebuild after CLI changes. |
| `bun run deploy` | `packages/server/scripts/deploy.ts`: reads `TRITON_URL` from the root `.env`, builds the web app and runs `wrangler deploy --minify --domain <host>`. Extra args pass through (`bun run deploy -- --dry-run`). |
| `bun run db:generate` (in `packages/server`) | Drizzle migration from `src/db/schema.ts`. |
| `bun run db:migrate:local` / `db:migrate` (in `packages/server`) | Apply migrations to local / remote D1 (binding `DB`). |

## Configuration

- `TRITON_URL` in the root `.env` is the single source of the instance URL: the CLI build bakes it in, the deploy derives the custom domain from it. `.env.development` points at `http://localhost:8787`. The server does not need it in production (file links use the request origin); locally it overrides the origin because `wrangler dev` rewrites request URLs.
- In the CLI the baked `TRITON_URL` is only the default server: `triton server` stores an override as `server` in the config file, and switching servers drops the session. A relative `TRITON_CONFIG_DIR` resolves against the folder holding `.env.development` (the repo root).
- `@aaldiin/triton` is published to npm from `packages/cli` by `.github/workflows/release.yml`: release-please (`release-please-config.json`, `.release-please-manifest.json`) opens the release PR from conventional commits under `packages/cli`, and merging it publishes via npm trusted publishing (`bun pm pack`, whose `prepack` builds with `vars.TRITON_URL`, then `npm publish` of the tarball, since `bun publish` has no OIDC). Running the Release workflow manually republishes the current version if a publish failed. In a workspace `bun pm pack --filename` resolves against the repo root, so pack with `--destination .`. Only `dist/` ships, so everything except the external `sharp` is a devDependency. `.github/workflows/ci.yml` runs install, tsc, `biome ci` and the build on pushes and PRs.
- With the repository variable `AUTO_DEPLOY=true`, the `deploy` job in `ci.yml` runs after `check` on every push to master: it writes `wrangler.jsonc` from the `WRANGLER_CONFIG` secret, applies remote migrations, then deploys (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `TRITON_URL` variable). Migrations run first while the old Worker is still live, so a schema change that breaks the running code (a rename, a dropped column) has to be split across two deploys, or deployed by hand with `AUTO_DEPLOY` off.
- `packages/server/wrangler.jsonc` is per-instance and gitignored; `wrangler.example.jsonc` is the template. A new dashboard page changes `run_worker_first`, so update the local file and the `WRANGLER_CONFIG` secret too. There is no `routes` entry: the domain comes only from `TRITON_URL` at deploy.
- Secrets: `MASTER_KEY` (32 bytes base64) and `BOOTSTRAP_CODE` via `wrangler secret put`; locally in `.dev.vars`.

## Architecture

Workspace packages:

- `packages/shared`: the API contract, zod schemas plus inferred types and the few pure helpers both sides must agree on (embed templates), shared by server, CLI and web. Its tsconfig has `types: []` on purpose, so it cannot use Bun or Workers APIs (it must run in both).
- `packages/server`: Hono on Cloudflare Workers, Drizzle on D1, encrypted files in R2. `scripts/` runs in Bun and has its own tsconfig with Bun types; `src/` uses Workers types.
- `packages/cli`: Bun CLI (`citty` commands plus a clack interactive menu). `@aaldiin/triton`, binary `triton`.
- `apps/web`: Next.js (App Router, React Compiler, Tailwind v4, shadcn/ui on Base UI, TanStack Query, next-themes) exported as static files and served by the same Worker. The Next docs for the installed version live in `apps/web/node_modules/next/dist/docs/`; read them before using Next APIs.

### Encryption and serving (server)

- Envelope encryption: each file gets a random AES-256-GCM key, wrapped with `MASTER_KEY` (AAD = file id) and stored in `files.wrapped_key`. Filenames are encrypted with the file key.
- `lib/stream-cipher.ts` seals uploads in 256 KiB chunks (IV = chunk index, AAD = final-chunk flag), so uploads stream through `FixedLengthStream` into R2 and `Range` requests decrypt only the needed chunks. Uploads require `Content-Length`.
- Keys derived from `MASTER_KEY` via HKDF (`lib/derived-keys.ts`, info `triton/<purpose>`): the upload-token HMAC key and the sealed-text key for invite codes. Changing the info string or `MASTER_KEY` invalidates every upload token and stored invite code; files only depend on `MASTER_KEY`.
- Tokens: session tokens (`trs_`) are random and stored as SHA-256 hashes in `tokens`. The web dashboard sends `X-Triton-Client: web` (`WEB_CLIENT_HEADER`); for those requests login/register set the token as an `HttpOnly` `SameSite=Strict` cookie on `/` and return only `{ user }` (`lib/web-session.ts`), and `requireAuth` falls back to that cookie (session tokens only, and only with the web header) when there is no bearer header. The path is `/` so the browser also sends it to `/<slug>` for private files. The upload token (`tru_<userId>.<hmac>`) is derived, not stored: one per account, upload-only, used by every ShareX config. `middleware/auth.ts` dispatches on the prefix.
- Accounts are identified by username (3 to 32 lowercase letters, digits, `.`, `_`, `-`; validated on register). Login only trims and lowercases, so migrated usernames that kept their full email still log in.
- Invite-only registration. The first account registers with `BOOTSTRAP_CODE` and becomes admin. Invite codes are stored hashed for lookup and sealed for display, and only open invites are decrypted when listing. Accounts are only reachable through their invite (`used_by` cascades on user delete); revoking access deletes the user, its files (D1 and R2) and sessions.
- The Worker serves `/api/*` and `/<id or vanity>(.ext)` (decrypted files with strict CSP; HTML/JS forced to attachment). The file CSP uses `sandbox allow-same-origin` without `allow-scripts`: scripts (including inline SVG scripts) never run, but the document keeps its origin so `media-src 'self'` matches. A bare `sandbox` gives an opaque origin and videos/audio opened directly no longer load. The dashboard is Workers static assets from `apps/web/out` (`assets` in `wrangler.jsonc` with the `ASSETS` binding; `run_worker_first` lists `/api/*` and every page path): for other paths assets win when a file exists, otherwise the Worker runs, so dashboard routes are fixed static paths and anything else is still a JSON 404. Never use `not_found_handling: "single-page-application"`: navigations would get `index.html` instead of reaching `/<id>`. Page security headers come from `apps/web/public/_headers`.
- Custom links: `files.vanity` is unique, lowercase and shared across all accounts. It is stored without an extension and any extension is ignored when serving, like ids, so `/name` and `/name.pptx` are the same file; `vanitySchema` strips a typed extension. `url` in `FileEntry` uses the vanity plus the real extension, and `/<id>` keeps working. Static assets win over the Worker, so `RESERVED_VANITIES` must cover every top-level name in `apps/web/out` (`login.txt`, `index.html`, `404.html`, `icon.svg`): add new pages there too. A vanity may not equal another file's id.
- Private files: `files.private` makes `/<slug>` answer 404 to everyone except the owner, checked by `viewerId` in `middleware/auth.ts` (bearer session or the cookie without the web header; upload tokens never count). The check runs before the ETag and Range handling. Private responses are `private, no-store` with a same-origin CORP, so dashboard `<img>`, `<video>` and text previews keep using the plain `/<slug>` path and the CLI downloads through `API.send` with its bearer token.
- Embeds: `embed_settings` holds one optional row per account, off by default (`lib/embeds.ts`, `/api/me/embed`). With it on, `/<slug>` answers link-preview crawlers (`CRAWLER_PATTERN`) with a small HTML page of meta tags for public images except SVG; everyone else, and any other type, gets the file. Videos stay plain links on purpose: Discord plays those on its own, and it drops the description from `og:video` embeds. Crawlers fetch the image with the same user agent, so the tags point at `?raw=1`, which always serves the file. Discord has no footer for link embeds: `siteName` and `author` go through `/api/oembed?file=<slug>`, which serves only what `loadEmbed` allows, so private files stay 404. Template text is filled by `fillEmbedText` in shared, so the dashboard preview and the Worker agree; `hono/html` escapes it on the way out.
- Response shapes are typed through `satisfies` against shared types; `toInvite` returns a discriminated union on `status` (`open | used | expired`).

### Web dashboard

- Static export only (`output: "export"` outside `next dev`): no server components with request data, no route handlers, no middleware, no dynamic segments. Everything is client-side: `lib/api.ts` calls the API with the shared zod schemas, TanStack Query caches it.
- Auth gating is client-side: `DashboardShell` redirects to `/login` on a 401 from `/api/me`. No page shows a splash or spinner: `/login` and `/register` render their form immediately, and the dashboard renders its shell immediately with skeletons wherever account data goes (`useCurrentAccount()` is `null` while loading; admin-only nav items keep a placeholder slot until the role is known). Web login/register and every web `GET /api/me` set `triton_signed_in=1` (`SIGNED_IN_COOKIE`, no secret, `SameSite=Lax` so links from other sites keep it). Page routing happens over HTTP so nothing paints first: `routes/pages.ts` runs for `MEMBER_PATHS` and `GUEST_PATHS` (shared, must match the `run_worker_first` list in `wrangler.jsonc` and the dashboard routes) and answers 302 or serves the page through the `ASSETS` binding; `next dev` does the same through dev-only `redirects()` in `next.config.ts`. `GuestGate` covers sessions without the hint. The server clears the hint together with the session cookie on logout and on every 401 to a web client, which prevents a `/login` ↔ `/` loop after a session expires.
- Loading states must match the loaded layout to the pixel. The saved grid/list choice lives in `localStorage` (`lib/file-view.ts`); a real inline `<head>` script in the root layout copies it to `data-file-view` on `<html>` before paint (not `next/script`: `beforeInteractive` is only queued in `self.__next_s` and runs after the Next bootstrap, so the page has already painted), and the `list-view` / `tiles-view` CSS variants pick the matching skeleton and toggle highlight before React hydrates (a variant must not start with `grid-`, Tailwind silently drops it). `html` has `scrollbar-gutter: stable` so the scrollbar appearing with data does not reflow the page. A 401 elsewhere only counts as an expired session while account data is cached, so a failed login does not reset the form.
- Auth cards are centered by CSS (`self-center`) on first paint, then `AuthCard` locks that position as a margin so a login error grows the card downward instead of shifting it.
- Uploads use `XMLHttpRequest` for progress (`components/uploads`); file thumbnails and previews load the public `/<id>` URLs by path. Video thumbnails capture one frame to a data URL kept in memory by file id, so the grid holds no live `<video>` elements: those restart on every remount and flicker under a blurred dialog.
- Pages are prerendered, so a value that only exists in the browser (`window.location`, a saved theme from `useTheme`) must wait for `useHydrated()` before it reaches the render output; attribute mismatches are never patched up by React. Dialog content with long names needs `grid-cols-[minmax(0,1fr)]`, otherwise the implicit grid track grows to the name's width. Touch sizing without editing shadcn files lives in the `pointer: coarse` block of `globals.css`.
- The React Compiler memoizes render output, so anything time-based (relative dates) must go through `RelativeTime`, which subscribes to a shared clock.
- `scripts/flatten-segments.ts` works around a Next export bug on Windows: segment prefetch files are written as nested folders (`__next.!X/page/__PAGE__.txt`) instead of dotted names (`__next.!X.page.__PAGE__.txt`), which made every prefetch 404. It is a no-op on Linux.

### Migrations

`migrations/` holds `0000_init.sql`, `0001_usernames.sql` (renames `email` to `username`; existing emails become their local part unless that would collide), `0002_file_links.sql` (adds `files.vanity` and `files.private`), `0003_embed_settings.sql` plus Drizzle's `meta/` snapshots (keep both in git; `db:generate` diffs against the snapshot). When Drizzle generates a table rebuild for SQLite, hand-edit it before applying: replace `PRAGMA foreign_keys` with `PRAGMA defer_foreign_keys = on/off` (D1) and add a `WHERE` to the copy if the new constraints would reject existing rows.

### CLI internals

- Interactive mode (`triton` with no args) runs in the terminal's alternate screen (`lib/screen.ts`). Every screen starts with `freshScreen()`; results that must survive the redraw go through `persist()` / `carry()`, and `task()` carries its done message automatically.
- Keyboard: clack owns stdin for the whole session. The only direct raw-stdin access is the one-time terminal capability probe (`lib/terminal.ts`) run at startup before any prompt; reading stdin mid-session froze input on Windows. Esc is removed from clack's cancel aliases at startup, so every screen needs an explicit Back option; Ctrl+C still cancels.
- Image previews (`lib/image.ts`) use kitty / iTerm2 / Sixel only and show nothing when unsupported (no half-block fallback). Sixel support and cell size come from the startup probe.
- Processes that must outlive the CLI (ShareX import, opening the browser) are started with `node:child_process` `spawn(..., { detached: true })`. `Bun.spawn` children are killed when the CLI exits on Windows, so it is only used for commands the CLI awaits.
- `triton sharex` imports into ShareX via the registered `ShareX.sxcu` open command (`ShareX.exe -CustomUploader <file>`), falling back to `sharex/` in the repo root when ShareX is not installed.

## Code style

The owner enforces these; follow them in all new code:

- These apply to everything except the shadcn-generated files in `apps/web/components/ui`, `hooks/use-mobile.ts` and `lib/utils.ts`, which stay as generated (and are excluded from Biome).
- No comments or JSDoc.
- No optional chaining (`?.`) and no non-null assertions (`!`); write explicit checks. `??` only for genuine defaults (env/config fallbacks, `??=` lazy init), never to paper over possibly-missing data.
- Function declarations (`function name()`), not `const name = () =>`; arrows only for inline callbacks.
- No explicit return types unless required (discriminated unions such as `RangeResult`, `Invite`, `AuthContext`, tuples, type predicates).
- No `any`; `noUncheckedIndexedAccess` is on. Prefer `Buffer.readUInt8` or destructuring with explicit `undefined` checks over `?? 0` on indexed access.
- Acronyms in identifiers are uppercase (`API`, `APIError`).
- Biome enforces `useAwait`, `noForEach`, `useBlockStatements` and `noNonNullAssertion` as errors. `useOptionalChain` is turned off because it would demand the `?.` this codebase bans.

## Windows notes

- Bun creates absolute symlinks in `node_modules`; after moving or renaming the repo, delete all `node_modules` folders and run `bun install`.
- `wrangler dev` started from a backgrounded shell can leave `workerd` running and holding port 8787; stop stray `workerd` processes before starting another dev server.
