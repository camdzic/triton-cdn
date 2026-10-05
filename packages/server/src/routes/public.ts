import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { files } from '../db/schema';
import type { AppEnv } from '../env';
import { contentDisposition, servedContentType } from '../lib/content-type';
import { parseRange } from '../lib/range';
import { objectKey, openFile } from '../lib/stored-files';
import { sealedSlice } from '../lib/stream-cipher';

const FILE_ROUTE = '/:slug{[A-Za-z0-9]{1,32}(?:\\.[A-Za-z0-9]{1,16})?}';

const FILE_HEADERS = {
  'Content-Security-Policy':
    "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'Accept-Ranges': 'bytes',
  'Cache-Control': 'public, max-age=86400'
};

function notFound() {
  return new HTTPException(404, { message: 'File not found' });
}

export const publicRoutes = new Hono<AppEnv>().get(FILE_ROUTE, async (c) => {
  const [id = ''] = c.req.param('slug').split('.');

  const row = await c
    .get('db')
    .select()
    .from(files)
    .where(eq(files.id, id))
    .get();

  if (!row) {
    throw notFound();
  }

  const etag = `"${row.id}"`;

  const headers = new Headers({
    ...FILE_HEADERS,
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
