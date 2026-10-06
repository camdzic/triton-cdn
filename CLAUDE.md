# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All from the repo root unless noted. Bun workspace (isolated linker); there is no test suite.

| Command | What it does |
| --- | --- |
| `bun run tsc` | `tsc -b` over all project references (shared, server, server/scripts, cli). Plain `tsc` at the root checks nothing. A single package: `bun run tsc` inside it (`tsc -p .`). |
| `bun run biome` | Biome check with `--write --unsafe`. Use `bunx biome check` to lint without fixing. |
| `bun run dev` | `wrangler dev` on `:8787` with local D1/R2, loading `.env.development` then `packages/server/.dev.vars`. |
| `bun run cli:dev [cmd]` | CLI from source against the local server; `.env.development` also sets `TRITON_CONFIG_DIR` to `.triton-local` so the production login is untouched. |
| `bun run cli [cmd]` | CLI from source against `TRITON_URL` in `.env`. |
| `bun run build` | Bundles the CLI to `packages/cli/dist/triton.js` with `TRITON_URL` inlined (`--env 'TRITON_*'`, `sharp` external). The linked `triton` command runs this file, so rebuild after CLI changes. |
| `bun run deploy` | `packages/server/scripts/deploy.ts`: reads `TRITON_URL` from the root `.env` and runs `wrangler deploy --minify --domain <host>`. Extra args pass through (`bun run deploy -- --dry-run`). |
| `bun run db:generate` (in `packages/server`) | Drizzle migration from `src/db/schema.ts`. |
| `bun run db:migrate:local` / `db:migrate` (in `packages/server`) | Apply migrations to local / remote D1 (binding `DB`). |

## Configuration

- `TRITON_URL` in the root `.env` is the single source of the instance URL: the CLI build bakes it in, the deploy derives the custom domain from it. `.env.development` points at `http://localhost:8787`. The server does not need it in production (file links use the request origin); locally it overrides the origin because `wrangler dev` rewrites request URLs.
- In the CLI the baked `TRITON_URL` is only the default server: `triton server` stores an override as `server` in the config file, and switching servers drops the session. A relative `TRITON_CONFIG_DIR` resolves against the folder holding `.env.development` (the repo root).
- `@triton/cli` is published to npm from `packages/cli` (`bun publish`, `prepublishOnly` rebuilds). Only `dist/` ships, so everything except the external `sharp` is a devDependency.
- `packages/server/wrangler.jsonc` is per-instance and gitignored; `wrangler.example.jsonc` is the template. There is no `routes` entry: the domain comes only from `TRITON_URL` at deploy.
- Secrets: `MASTER_KEY` (32 bytes base64) and `BOOTSTRAP_CODE` via `wrangler secret put`; locally in `.dev.vars`.

## Architecture

Three workspace packages:

- `packages/shared`: the API contract only, zod schemas plus inferred types, shared by server and CLI. Its tsconfig has `types: []` on purpose, so it cannot use Bun or Workers APIs (it must run in both).
- `packages/server`: Hono on Cloudflare Workers, Drizzle on D1, encrypted files in R2. `scripts/` runs in Bun and has its own tsconfig with Bun types; `src/` uses Workers types.
- `packages/cli`: Bun CLI (`citty` commands plus a clack interactive menu). `@triton/cli`, binary `triton`.

### Encryption and serving (server)

- Envelope encryption: each file gets a random AES-256-GCM key, wrapped with `MASTER_KEY` (AAD = file id) and stored in `files.wrapped_key`. Filenames are encrypted with the file key.
- `lib/stream-cipher.ts` seals uploads in 256 KiB chunks (IV = chunk index, AAD = final-chunk flag), so uploads stream through `FixedLengthStream` into R2 and `Range` requests decrypt only the needed chunks. Uploads require `Content-Length`.
- Keys derived from `MASTER_KEY` via HKDF (`lib/derived-keys.ts`, info `triton/<purpose>`): the upload-token HMAC key and the sealed-text key for invite codes. Changing the info string or `MASTER_KEY` invalidates every upload token and stored invite code; files only depend on `MASTER_KEY`.
- Tokens: session tokens (`trs_`) are random and stored as SHA-256 hashes in `tokens`. The upload token (`tru_<userId>.<hmac>`) is derived, not stored: one per account, upload-only, used by every ShareX config. `middleware/auth.ts` dispatches on the prefix.
- Invite-only registration. The first account registers with `BOOTSTRAP_CODE` and becomes admin. Invite codes are stored hashed for lookup and sealed for display, and only open invites are decrypted when listing. Accounts are only reachable through their invite (`used_by` cascades on user delete); revoking access deletes the user, its files (D1 and R2) and sessions.
- The domain serves only `/api/*` and `/<id>(.ext)` (public decrypted files with strict CSP; HTML/JS forced to attachment). Everything else is a JSON 404. There is no web frontend by design.
- Response shapes are typed through `satisfies` against shared types; `toInvite` returns a discriminated union on `status` (`open | used | expired`).

### Migrations

`migrations/` holds a single `0000_init.sql` plus Drizzle's `meta/` snapshot (keep both in git; `db:generate` diffs against the snapshot). When Drizzle generates a table rebuild for SQLite, hand-edit it before applying: replace `PRAGMA foreign_keys` with `PRAGMA defer_foreign_keys = on/off` (D1) and add a `WHERE` to the copy if the new constraints would reject existing rows.

### CLI internals

- Interactive mode (`triton` with no args) runs in the terminal's alternate screen (`lib/screen.ts`). Every screen starts with `freshScreen()`; results that must survive the redraw go through `persist()` / `carry()`, and `task()` carries its done message automatically.
- Keyboard: clack owns stdin for the whole session. The only direct raw-stdin access is the one-time terminal capability probe (`lib/terminal.ts`) run at startup before any prompt; reading stdin mid-session froze input on Windows. Esc is removed from clack's cancel aliases at startup, so every screen needs an explicit Back option; Ctrl+C still cancels.
- Image previews (`lib/image.ts`) use kitty / iTerm2 / Sixel only and show nothing when unsupported (no half-block fallback). Sixel support and cell size come from the startup probe.
- Processes that must outlive the CLI (ShareX import, opening the browser) are started with `node:child_process` `spawn(..., { detached: true })`. `Bun.spawn` children are killed when the CLI exits on Windows, so it is only used for commands the CLI awaits.
- `triton sharex` imports into ShareX via the registered `ShareX.sxcu` open command (`ShareX.exe -CustomUploader <file>`), falling back to `sharex/` in the repo root when ShareX is not installed.

## Code style

The owner enforces these; follow them in all new code:

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
