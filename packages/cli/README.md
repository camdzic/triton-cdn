# @aaldiin/triton

Terminal client for [triton](https://github.com/camdzic/triton-cdn), a self-hosted encrypted CDN on Cloudflare Workers, R2 and D1.

Requires [Bun](https://bun.sh).

```bash
bun install -g @aaldiin/triton
triton
```

Running `triton` with no arguments opens the interactive menu. Everything is also available as commands, see `triton --help`.

## Server

The CLI talks to the default triton instance out of the box. To use your own:

```bash
triton server https://cdn.example.com
```

`triton server` shows the current server, its status and the signed-in account, and lets you change it. `triton server --reset` switches back to the default. Switching servers logs you out, because accounts belong to one server.

## Environment

`TRITON_CONFIG_DIR` overrides where the login is stored, `TRITON_IMAGE_PROTOCOL` (`kitty`, `iterm`, `sixel`, `none`) overrides image preview detection.
