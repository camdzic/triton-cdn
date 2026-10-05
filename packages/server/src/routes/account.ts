import type { Account, UploadToken } from '@triton/shared';
import { count, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { aggregateRow, total } from '../db/aggregates';
import { files } from '../db/schema';
import type { AppEnv } from '../env';
import { toUser } from '../lib/serialize';
import { uploadTokenFor } from '../lib/upload-token';
import { requireAuth } from '../middleware/auth';

export const accountRoutes = new Hono<AppEnv>()
  .use(requireAuth('session'))
  .get('/', async (c) => {
    const { user } = c.get('auth');

    const usage = aggregateRow(
      await c
        .get('db')
        .select({ files: count(), bytes: total(files.size) })
        .from(files)
        .where(eq(files.userId, user.id))
        .get()
    );

    return c.json({ user: toUser(user), usage } satisfies Account);
  })
  .get('/upload-token', async (c) =>
    c.json({
      token: await uploadTokenFor(c.env.MASTER_KEY, c.get('auth').user.id)
    } satisfies UploadToken)
  );
