import {
  loginInputSchema,
  type Ok,
  registerInputSchema,
  type Session,
  type WebSession
} from '@triton/shared';
import { and, count, eq, gt, isNull } from 'drizzle-orm';
import { type Context, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { aggregateRow } from '../db/aggregates';
import { invites, tokens, type UserRow, users } from '../db/schema';
import type { AppEnv } from '../env';
import { safeEqual, sha256Hex } from '../lib/hash';
import { hashPassword, verifyDecoy, verifyPassword } from '../lib/password';
import { randomId } from '../lib/random';
import { toUser } from '../lib/serialize';
import { issueSession } from '../lib/sessions';
import {
  clearSessionCookie,
  isWebClient,
  setSessionCookie
} from '../lib/web-session';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';
import { validate } from '../middleware/validate';

function invalidInvite() {
  return new HTTPException(400, {
    message: 'Invite code is invalid or expired'
  });
}

function sessionResponse(
  c: Context<AppEnv>,
  token: string,
  user: UserRow,
  status: 200 | 201
) {
  if (isWebClient(c)) {
    setSessionCookie(c, token);

    return c.json({ user: toUser(user) } satisfies WebSession, status);
  }

  return c.json({ token, user: toUser(user) } satisfies Session, status);
}

export const authRoutes = new Hono<AppEnv>()
  .post(
    '/register',
    rateLimit('register'),
    validate('json', registerInputSchema),
    async (c) => {
      const { username, password, invite } = c.req.valid('json');

      const db = c.get('db');
      const now = new Date();

      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username))
        .get();

      if (existing) {
        throw new HTTPException(409, {
          message: 'This username is already taken'
        });
      }

      const population = aggregateRow(
        await db.select({ accounts: count() }).from(users).get()
      );
      const bootstrap = population.accounts === 0;

      const pendingInvite = bootstrap
        ? null
        : await db
            .select({ id: invites.id })
            .from(invites)
            .where(
              and(
                eq(invites.hash, await sha256Hex(invite.toUpperCase())),
                isNull(invites.usedAt),
                gt(invites.expiresAt, now)
              )
            )
            .get();

      if (
        bootstrap ? !safeEqual(invite, c.env.BOOTSTRAP_CODE) : !pendingInvite
      ) {
        throw invalidInvite();
      }

      const user = await db
        .insert(users)
        .values({
          id: randomId(16),
          username,
          passwordHash: await hashPassword(password),
          role: bootstrap ? 'admin' : 'user',
          createdAt: now
        })
        .returning()
        .get();

      if (pendingInvite) {
        const claimed = await db
          .update(invites)
          .set({ usedBy: user.id, usedAt: now })
          .where(and(eq(invites.id, pendingInvite.id), isNull(invites.usedAt)))
          .returning({ id: invites.id })
          .get();

        if (!claimed) {
          await db.delete(users).where(eq(users.id, user.id));

          throw invalidInvite();
        }
      }

      const token = await issueSession(
        db,
        user.id,
        isWebClient(c) ? 'Web' : 'CLI'
      );

      return sessionResponse(c, token, user, 201);
    }
  )
  .post(
    '/login',
    rateLimit('login'),
    validate('json', loginInputSchema),
    async (c) => {
      const { username, password, device } = c.req.valid('json');

      const db = c.get('db');

      const user = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .get();

      const valid = user
        ? await verifyPassword(password, user.passwordHash)
        : await verifyDecoy(password);

      if (!user || !valid) {
        throw new HTTPException(401, {
          message: 'Invalid username or password'
        });
      }

      const token = await issueSession(db, user.id, device);

      return sessionResponse(c, token, user, 200);
    }
  )
  .post('/logout', requireAuth('session'), async (c) => {
    const auth = c.get('auth');

    if (auth.kind === 'session') {
      await c.get('db').delete(tokens).where(eq(tokens.id, auth.sessionId));
    }

    if (isWebClient(c)) {
      clearSessionCookie(c);
    }

    return c.json({ ok: true } satisfies Ok);
  });
