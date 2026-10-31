import type { OEmbed } from '@triton/shared';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../env';
import { loadEmbed } from '../lib/embeds';
import { findBySlug } from '../lib/stored-files';

function notFound() {
  return new HTTPException(404, { message: 'File not found' });
}

export const oEmbedRoutes = new Hono<AppEnv>().get('/', async (c) => {
  const slug = c.req.query('file');

  if (slug === undefined) {
    throw notFound();
  }

  const db = c.get('db');
  const row = await findBySlug(db, slug);

  if (!row) {
    throw notFound();
  }

  const embed = await loadEmbed(db, c.env.MASTER_KEY, row);

  if (embed === null) {
    throw notFound();
  }

  return c.json({
    version: '1.0',
    type: 'link',
    ...(embed.author === '' ? {} : { author_name: embed.author }),
    ...(embed.siteName === '' ? {} : { provider_name: embed.siteName })
  } satisfies OEmbed);
});
