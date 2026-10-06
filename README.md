# triton-cdn

Self-hosted encrypted CDN on Cloudflare Workers, R2 and D1, managed entirely from a terminal CLI.

- Every file is encrypted with its own AES-256-GCM key before it touches R2. Keys are wrapped with a master secret that only the Worker knows, and filenames are encrypted too.
- Uploads stream through the Worker in 256 KiB sealed chunks, so large files never sit in memory and range requests (video seeking) work.
- Invite-only accounts. Every account has one built-in upload-only token for ShareX, derived from the master key, so there is nothing to create or manage.
- Real image previews in terminals that support them (Windows Terminal 1.22+ via Sixel, kitty, Ghostty, iTerm2, WezTerm, mintty). Other terminals just show file info.

```
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

The deploy attaches that domain to the Worker, and the CLI build bakes the same URL in, so a built CLI always talks to its own server. `.env` is gitignored.

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

`bun run deploy` deploys to the domain from `TRITON_URL`, which must be a zone in the same Cloudflare account.

`MASTER_KEY` encrypts every file key. Back it up somewhere safe: losing it makes all stored files unreadable.

`BOOTSTRAP_CODE` is the invite code for the very first account, which becomes the admin. After that, invites come from `triton invites`.

## CLI

```bash
bun run build
cd packages/cli
bun link
triton
```

`bun run build` bakes `TRITON_URL` into `packages/cli/dist/triton.js`. Rebuild after changing it.

Running `triton` with no arguments opens the interactive menu. Everything is also available as commands:

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

## API

| Method | Path | Auth |
| --- | --- | --- |
| `POST` | `/api/auth/register` | invite code |
| `POST` | `/api/auth/login` | |
| `POST` | `/api/auth/logout` | session |
| `GET` | `/api/me` | session |
| `PUT` | `/api/files?filename=` | session or upload token, raw body |
| `GET` | `/api/files?limit=&offset=` | session |
| `GET` `DELETE` | `/api/files/:id` | session |
| `GET` | `/api/me/upload-token` | session |
| `GET` `POST` | `/api/invites` | admin |
| `DELETE` | `/api/invites/:id` | admin |
| `GET` | `/:id(.ext)` | public, supports `Range` |
