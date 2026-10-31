import { GUEST_PATHS, MEMBER_PATHS, SIGNED_IN_COOKIE } from '@triton/shared';
import { type Context, Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppEnv } from '../env';

function signedIn(c: Context<AppEnv>) {
  return getCookie(c, SIGNED_IN_COOKIE) !== undefined;
}

function redirect(c: Context<AppEnv>, path: string) {
  c.header('Cache-Control', 'no-store');

  return c.redirect(path, 302);
}

export const pageRoutes = new Hono<AppEnv>();

for (const path of MEMBER_PATHS) {
  pageRoutes.get(path, (c) =>
    signedIn(c) ? c.env.ASSETS.fetch(c.req.raw) : redirect(c, '/login')
  );
}

for (const path of GUEST_PATHS) {
  pageRoutes.get(path, (c) =>
    signedIn(c) ? redirect(c, '/') : c.env.ASSETS.fetch(c.req.raw)
  );
}
