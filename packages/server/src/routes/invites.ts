import {
  type CreatedInvite,
  createInviteInputSchema,
  type Invite,
  type Ok
} from '@triton/shared';
import { desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { files, invites, users } from '../db/schema';
import type { AppEnv } from '../env';
import { removeAccount } from '../lib/accounts';
import { sha256Hex } from '../lib/hash';
import { randomId } from '../lib/random';
import { openText, sealText } from '../lib/sealed-text';
import { toInvite } from '../lib/serialize';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

const DAY_MS = 24 * 60 * 60 * 1000;
const CODE_GROUP = 4;

function formatCode(raw: string) {
  return Array.from(
    { length: Math.ceil(raw.length / CODE_GROUP) },
    (_, group) => raw.slice(group * CODE_GROUP, (group + 1) * CODE_GROUP)
  ).join('-');
}

const accountFiles =
  sql<number>`(select count(*) from ${files} where ${files.userId} = ${invites.usedBy})`.mapWith(
    Number
  );

const accountBytes =
  sql<number>`(select coalesce(sum(${files.size}), 0) from ${files} where ${files.userId} = ${invites.usedBy})`.mapWith(
    Number
  );

export const inviteRoutes = new Hono<AppEnv>()
  .use(requireAuth('session'), requireAdmin)
  .get('/', async (c) => {
    const rows = await c
      .get('db')
      .select({
        invite: invites,
        email: users.email,
        files: accountFiles,
        bytes: accountBytes
      })
      .from(invites)
      .leftJoin(users, eq(invites.usedBy, users.id))
      .orderBy(desc(invites.createdAt))
      .all();

    const entries = await Promise.all(
      rows.map((row) =>
        toInvite(
          row.invite,
          row.email === null
            ? null
            : { email: row.email, files: row.files, bytes: row.bytes },
          () => openText(c.env.MASTER_KEY, row.invite.code, row.invite.id)
        )
      )
    );

    return c.json(entries satisfies Invite[]);
  })
  .post('/', validate('json', createInviteInputSchema), async (c) => {
    const { expiresInDays } = c.req.valid('json');
    const id = randomId(16);
    const code = formatCode(randomId(16).toUpperCase());
    const now = Date.now();

    const row = await c
      .get('db')
      .insert(invites)
      .values({
        id,
        hash: await sha256Hex(code),
        code: await sealText(c.env.MASTER_KEY, code, id),
        createdBy: c.get('auth').user.id,
        createdAt: new Date(now),
        expiresAt: new Date(now + expiresInDays * DAY_MS)
      })
      .returning()
      .get();

    return c.json(
      {
        code,
        invite: await toInvite(row, null, () => Promise.resolve(code))
      } satisfies CreatedInvite,
      201
    );
  })
  .delete('/:id/account', async (c) => {
    const invite = await c
      .get('db')
      .select({ usedBy: invites.usedBy })
      .from(invites)
      .where(eq(invites.id, c.req.param('id')))
      .get();

    if (!invite || !invite.usedBy) {
      throw new HTTPException(404, {
        message: 'No account is linked to this invite'
      });
    }

    if (invite.usedBy === c.get('auth').user.id) {
      throw new HTTPException(400, {
        message: 'You cannot remove your own account'
      });
    }

    await removeAccount(c.get('db'), c.env.BUCKET, invite.usedBy);

    return c.json({ ok: true } satisfies Ok);
  })
  .delete('/:id', async (c) => {
    const deleted = await c
      .get('db')
      .delete(invites)
      .where(eq(invites.id, c.req.param('id')))
      .returning({ id: invites.id })
      .get();

    if (!deleted) {
      throw new HTTPException(404, { message: 'Invite not found' });
    }

    return c.json({ ok: true } satisfies Ok);
  });
