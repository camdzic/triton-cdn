import { eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { tokens, users } from '../db/schema';
import type { AppEnv, AuthContext } from '../env';
import { sha256Hex } from '../lib/hash';
import { type TokenKind, tokenKindOf } from '../lib/sessions';
import { verifyUploadToken } from '../lib/upload-token';

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

function unauthorized() {
  return new HTTPException(401, { message: 'Invalid or expired token' });
}

const BEARER_PREFIX = 'bearer ';

function bearerToken(header: string | undefined) {
  if (header === undefined || !header.toLowerCase().startsWith(BEARER_PREFIX)) {
    return null;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();

  return token === '' ? null : token;
}

async function authenticateSession(
  c: Context<AppEnv>,
  token: string
): Promise<AuthContext> {
  const db = c.get('db');

  const row = await db
    .select({ session: tokens, user: users })
    .from(tokens)
    .innerJoin(users, eq(tokens.userId, users.id))
    .where(eq(tokens.hash, await sha256Hex(token)))
    .get();

  const now = Date.now();

  if (!row || row.session.expiresAt.getTime() <= now) {
    throw unauthorized();
  }

  if (
    !row.session.lastUsedAt ||
    now - row.session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS
  ) {
    c.executionCtx.waitUntil(
      db
        .update(tokens)
        .set({ lastUsedAt: new Date(now) })
        .where(eq(tokens.id, row.session.id))
        .run()
    );
  }

  return { kind: 'session', user: row.user, sessionId: row.session.id };
}

async function authenticateUpload(
  c: Context<AppEnv>,
  token: string
): Promise<AuthContext> {
  const userId = await verifyUploadToken(c.env.MASTER_KEY, token);
  const user = userId
    ? await c.get('db').select().from(users).where(eq(users.id, userId)).get()
    : undefined;

  if (!user) {
    throw unauthorized();
  }

  return { kind: 'upload', user };
}

export function requireAuth(...allowed: TokenKind[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const token = bearerToken(c.req.header('authorization'));
    const kind = token ? tokenKindOf(token) : null;

    if (!token || !kind) {
      throw unauthorized();
    }

    if (!allowed.includes(kind)) {
      throw new HTTPException(403, {
        message: 'This token cannot be used here'
      });
    }

    c.set(
      'auth',
      kind === 'session'
        ? await authenticateSession(c, token)
        : await authenticateUpload(c, token)
    );

    await next();
  });
}

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get('auth').user.role !== 'admin') {
    throw new HTTPException(403, { message: 'Admin access required' });
  }

  await next();
});
