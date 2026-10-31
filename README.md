# triton-cdn

Self-hosted encrypted CDN on Cloudflare Workers, R2 and D1, managed from a terminal CLI or a web dashboard on the same domain.

- Every file is encrypted with its own AES-256-GCM key before it touches R2. Keys are wrapped with a master secret that only the Worker knows, and filenames are encrypted too.
- Uploads stream through the Worker in 256 KiB sealed chunks, so large files never sit in memory and range requests (video seeking) work.
- Invite-only accounts. Every account has one built-in upload-only token for ShareX, derived from the master key, so there is nothing to create or manage.
- A web dashboard (Next.js static export) served by the same Worker: files, uploads with drag and drop, invites, ShareX configs, light and dark mode, works on phones.
- Optional per-account link embeds for Discord and other apps: color, site name, author, title and description with `{filename}`, `{size}`, `{date}` and `{username}`, for public images and videos.
- Real image previews in terminals that support them (Windows Terminal 1.22+ via Sixel, kitty, Ghostty, iTerm2, WezTerm, mintty). Other terminals just show file info.

```
apps/
  web/      Next.js dashboard, exported to static files
packages/
  shared/   API contract (zod schemas + types)
  server/   Hono app for Cloudflare Workers
  cli/      Bun CLI
```

## Configuration

The whole monorepo shares one setting, the public URL of your instance, in the root `.env`:

```bash
cp .env.example .env
```

```
TRITON_URL=https://cdn.example.com
```

The deploy attaches that domain to the Worker, and the CLI build bakes the same URL in, so a built CLI talks to its own server by default. `.env` is gitignored.

## Deploy

```bash
bun install
cd packages/server
cp wrangler.example.jsonc wrangler.jsonc
bunx wrangler login
bunx wrangler d1 create triton
bunx wrangler r2 bucket create triton-files
```

Fill in your instance in `wrangler.jsonc` (it is gitignored, so it stays yours):

| Field | Value |
| --- | --- |
| `d1_databases[0].database_id` | the id printed by `d1 create` |
| `d1_databases[0].database_name` / `r2_buckets[0].bucket_name` | only if you picked other names above |
| `ratelimits[0].namespace_id` | any number unique among rate limiters in your account, `1001` is fine |

Then:

```bash
bun run db:migrate
openssl rand -base64 32 | bunx wrangler secret put MASTER_KEY
bunx wrangler secret put BOOTSTRAP_CODE
bun run deploy
```

`bun run deploy` builds the web dashboard and deploys it with the Worker to the domain from `TRITON_URL`, which must be a zone in the same Cloudflare account. The dashboard is served as Workers static assets from the same Worker, so it needs no extra Cloudflare resources. If your `wrangler.jsonc` predates the dashboard, copy the whole `assets` block from `wrangler.example.jsonc`, including `binding` and `run_worker_first`.

`MASTER_KEY` encrypts every file key. Back it up somewhere safe: losing it makes all stored files unreadable.

`BOOTSTRAP_CODE` is the invite code for the very first account, which becomes the admin. After that, invites come from `triton invites`.

## CLI

Install it from npm (requires Bun):

```bash
bun install -g @aaldiin/triton
triton
```

The published CLI talks to the default instance. `triton server <url>` points it at your own, `triton server` shows the current one and `triton server --reset` switches back. Switching servers logs you out.

To build it from source instead:

```bash
bun run build
cd packages/cli
bun link
triton
```

`bun run build` bakes `TRITON_URL` into `packages/cli/dist/triton.js` as the default server. Rebuild after changing it.

Releases are automated with release-please. Conventional commits that touch `packages/cli` (`fix:` bumps the patch, `feat:` the minor while below 1.0) keep a release PR up to date with the next version and changelog. Merging it tags `vX.Y.Z`, creates the GitHub release and publishes to npm through trusted publishing, with the `TRITON_URL` repository variable baked in as the default server.

Running `triton` with no arguments opens the interactive menu. Everything is also available as commands, and `triton --help` lists them all. For custom links and private files:

```bash
triton upload secret.pdf --private
triton link <id> prezentacija
triton link <id> --remove
triton private <id>
triton public <id>
```

## Web dashboard

Open your instance URL in a browser. Signed out, it asks you to log in or register with an invite code; signed in, it opens straight to your files. Admins also get an Invites page, and invite links (`/register?code=...`) prefill the code. Browser sessions use an `HttpOnly`, `SameSite=Strict` cookie instead of a bearer token.

The pages are static files, so the Worker still owns `/api/*` and `/<id>(.ext)`: existing file links keep working.

## Custom links and private files

Any file can get a custom link, set from the dashboard or with `triton link`. Names are 3 to 64 letters, numbers, dashes or underscores, case-insensitive and unique across the whole instance. The extension is not part of the name: `prezentacija` serves the file at both `/prezentacija` and `/prezentacija.pptx`, and the original `/<id>` link keeps working. Page names such as `login` are reserved.

Files are public by default. A private file answers 404 to everyone except its owner, on both its id and its custom link. In a browser the owner must be signed in to the dashboard, and opening the link from another site also gives a 404 because the session cookie is `SameSite=Strict`. Making a file private does not reach copies already saved by someone who opened it while it was public.

## Environment

Environment overrides: `TRITON_CONFIG_DIR` (a relative path resolves against the repo root), `TRITON_IMAGE_PROTOCOL` (`kitty`, `iterm`, `sixel`, `none`).

## Local development

`.env.development` points everything at `http://localhost:8787`.

```bash
cd packages/server
cp .dev.vars.example .dev.vars
cp wrangler.example.jsonc wrangler.jsonc
bun run db:migrate:local
cd ../..
bun run dev
```

In a second terminal, run the CLI from source against the local server. `.env.development` also points it at its own config folder (`.triton-local`), so your production login stays untouched:

```bash
bun run cli:dev
```

`bun run cli` runs the CLI from source against `TRITON_URL` from `.env`.

`bun run dev` serves the last web build from `apps/web/out` (it builds it once if missing). For live reload while working on the dashboard, run this in another terminal and open `http://localhost:3000`; it proxies `/api` and file links to the local Worker:

```bash
bun run dev:web
```

## API

| Method | Path | Auth |
| --- | --- | --- |
| `POST` | `/api/auth/register` | invite code |
| `POST` | `/api/auth/login` | |
| `POST` | `/api/auth/logout` | session |
| `GET` | `/api/me` | session |
| `PUT` | `/api/files?filename=&private=` | session or upload token, raw body |
| `GET` | `/api/files?limit=&offset=` | session |
| `GET` `PATCH` `DELETE` | `/api/files/:id` | session |
| `GET` | `/api/me/upload-token` | session |
| `GET` `PUT` | `/api/me/embed` | session |
| `GET` | `/api/oembed?file=` | public, embed-enabled files only |
| `GET` `POST` | `/api/invites` | admin |
| `DELETE` | `/api/invites/:id` | admin |
| `GET` | `/:id(.ext)` or `/:vanity(.ext)` | public, or owner for private files, supports `Range`; `?raw=1` skips the embed page |

Session endpoints accept `Authorization: Bearer trs_...` (CLI) or the session cookie together with `X-Triton-Client: web` (dashboard).
