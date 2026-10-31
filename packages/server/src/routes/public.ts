import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../env';
import { contentDisposition, servedContentType } from '../lib/content-type';
import { embedPage, isEmbedCrawler, loadEmbed } from '../lib/embeds';
import { parseRange } from '../lib/range';
import { fileSlug, fileUrl, publicOrigin } from '../lib/serialize';
import { findBySlug, objectKey, openFile } from '../lib/stored-files';
import { sealedSlice } from '../lib/stream-cipher';
import { viewerId } from '../middleware/auth';

const FILE_ROUTE = '/:slug{[A-Za-z0-9_-]{1,64}(?:\\.[A-Za-z0-9]{1,16})?}';

const FILE_HEADERS = {
  'Content-Security-Policy':
    "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox allow-same-origin",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'Accept-Ranges': 'bytes',
  'Cache-Control': 'public, max-age=86400',
  Vary: 'User-Agent'
};

const EMBED_HEADERS = {
  'Content-Security-Policy': "default-src 'none'; sandbox",
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
  Vary: 'User-Agent'
};

const PRIVATE_HEADERS = {
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cache-Control': 'private, no-store'
};

function notFound() {
  return new HTTPException(404, { message: 'File not found' });
}

export const publicRoutes = new Hono<AppEnv>().get(FILE_ROUTE, async (c) => {
  const db = c.get('db');
  const row = await findBySlug(db, c.req.param('slug'));

  if (!row) {
    throw notFound();
  }

  if (row.private && (await viewerId(c)) !== row.userId) {
    throw notFound();
  }

  if (
    c.req.query('raw') === undefined &&
    isEmbedCrawler(c.req.header('user-agent'))
  ) {
    const embed = await loadEmbed(db, c.env.MASTER_KEY, row);

    if (embed !== null) {
      const origin = publicOrigin(c.env, c.req.url);
      const slug = fileSlug(row);

      return c.html(
        embedPage(
          embed,
          fileUrl(origin, slug, embed.name),
          `${origin}/api/oembed?${new URLSearchParams({ file: slug })}`
        ),
        200,
        EMBED_HEADERS
      );
    }
  }

  const etag = `"${row.id}"`;

  const headers = new Headers({
    ...FILE_HEADERS,
    ...(row.private ? PRIVATE_HEADERS : {}),
    ETag: etag,
    'Last-Modified': row.createdAt.toUTCString()
  });

  if (c.req.header('if-none-match') === etag) {
    return new Response(null, { status: 304, headers });
  }

  const { key, name } = await openFile(c.env.MASTER_KEY, row);

  headers.set('Content-Type', servedContentType(row.contentType));
  headers.set('Content-Disposition', contentDisposition(row.contentType, name));

  const requested = parseRange(c.req.header('range'), row.size);

  if (requested.kind === 'unsatisfiable') {
    headers.set('Content-Range', `bytes */${row.size}`);

    return new Response(null, { status: 416, headers });
  }

  const range =
    requested.kind === 'partial'
      ? requested.range
      : { start: 0, length: row.size };

  const status = requested.kind === 'partial' ? 206 : 200;

  headers.set('Content-Length', String(range.length));

  if (requested.kind === 'partial') {
    headers.set(
      'Content-Range',
      `bytes ${range.start}-${range.start + range.length - 1}/${row.size}`
    );
  }

  if (c.req.method === 'HEAD') {
    return new Response(null, { status, headers });
  }

  const slice = sealedSlice(key, row.size, range);

  const object = await c.env.BUCKET.get(objectKey(row.id), {
    range: { offset: slice.offset, length: slice.length }
  });

  if (!object) {
    throw notFound();
  }

  return new Response(
    object.body
      .pipeThrough(slice.decrypt())
      .pipeThrough(new FixedLengthStream(range.length)),
    { status, headers }
  );
});
