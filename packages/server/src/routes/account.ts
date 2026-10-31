import {
  type Account,
  type EmbedSettings,
  embedSettingsSchema,
  type UploadToken
} from '@triton/shared';
import { count, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { aggregateRow, total } from '../db/aggregates';
import { files } from '../db/schema';
import type { AppEnv } from '../env';
import { embedSettingsFor, saveEmbedSettings } from '../lib/embeds';
import { toUser } from '../lib/serialize';
import { uploadTokenFor } from '../lib/upload-token';
import { isWebClient, setSignedInHint } from '../lib/web-session';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

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

    if (isWebClient(c)) {
      setSignedInHint(c);
    }

    return c.json({ user: toUser(user), usage } satisfies Account);
  })
  .get('/upload-token', async (c) =>
    c.json({
      token: await uploadTokenFor(c.env.MASTER_KEY, c.get('auth').user.id)
    } satisfies UploadToken)
  )
  .get('/embed', async (c) =>
    c.json(
      (await embedSettingsFor(
        c.get('db'),
        c.get('auth').user.id
      )) satisfies EmbedSettings
    )
  )
  .put('/embed', validate('json', embedSettingsSchema), async (c) =>
    c.json(
      (await saveEmbedSettings(
        c.get('db'),
        c.get('auth').user.id,
        c.req.valid('json')
      )) satisfies EmbedSettings
    )
  );
