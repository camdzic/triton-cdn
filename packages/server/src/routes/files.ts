import {
  type FileEntry,
  type FilePage,
  listFilesQuerySchema,
  type Ok,
  uploadQuerySchema
} from '@triton/shared';
import { and, count, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { aggregateRow } from '../db/aggregates';
import { files } from '../db/schema';
import type { AppEnv, Bindings } from '../env';
import { resolveContentType } from '../lib/content-type';
import { createFileKey, encryptName } from '../lib/envelope';
import { randomId } from '../lib/random';
import { toFileEntry } from '../lib/serialize';
import { objectKey, openFile, removeFile } from '../lib/stored-files';
import { encryptStream, sealedSize } from '../lib/stream-cipher';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

function publicOrigin(env: Bindings, url: string) {
  return env.TRITON_URL === undefined ? new URL(url).origin : env.TRITON_URL;
}

function notFound() {
  return new HTTPException(404, { message: 'File not found' });
}

function declaredSize(header: string | undefined) {
  const size = Number(header);

  return header && Number.isSafeInteger(size) && size >= 0 ? size : null;
}

export const fileRoutes = new Hono<AppEnv>()
  .on(
    ['PUT', 'POST'],
    '/',
    requireAuth('session', 'upload'),
    validate('query', uploadQuerySchema),
    async (c) => {
      const { filename } = c.req.valid('query');

      const size = declaredSize(c.req.header('content-length'));

      if (size === null) {
        throw new HTTPException(411, {
          message: 'Content-Length header is required'
        });
      }

      if (size > Number(c.env.MAX_UPLOAD_BYTES)) {
        throw new HTTPException(413, { message: 'File is too large' });
      }

      const id = randomId(10);
      const fileKey = await createFileKey(c.env.MASTER_KEY, id);

      const body = c.req.raw.body ?? new Blob([]).stream();

      await c.env.BUCKET.put(
        objectKey(id),
        body
          .pipeThrough(encryptStream(fileKey.key, size))
          .pipeThrough(new FixedLengthStream(sealedSize(size)))
      );

      const row = await c
        .get('db')
        .insert(files)
        .values({
          id,
          userId: c.get('auth').user.id,
          name: await encryptName(fileKey.key, filename),
          contentType: resolveContentType(
            c.req.header('content-type'),
            filename
          ),
          size,
          wrappedKey: fileKey.wrapped,
          createdAt: new Date()
        })
        .returning()
        .get();

      return c.json(
        toFileEntry(
          row,
          filename,
          publicOrigin(c.env, c.req.url)
        ) satisfies FileEntry,
        201
      );
    }
  )
  .get(
    '/',
    requireAuth('session'),
    validate('query', listFilesQuerySchema),
    async (c) => {
      const { limit, offset } = c.req.valid('query');

      const db = c.get('db');

      const owner = eq(files.userId, c.get('auth').user.id);

      const [rows, counted] = await Promise.all([
        db
          .select()
          .from(files)
          .where(owner)
          .orderBy(desc(files.createdAt), desc(files.id))
          .limit(limit)
          .offset(offset)
          .all(),
        db.select({ total: count() }).from(files).where(owner).get()
      ]);

      const entries = await Promise.all(
        rows.map(async (row) => {
          const { name } = await openFile(c.env.MASTER_KEY, row);

          return toFileEntry(row, name, publicOrigin(c.env, c.req.url));
        })
      );

      return c.json({
        files: entries,
        total: aggregateRow(counted).total,
        limit,
        offset
      } satisfies FilePage);
    }
  )
  .get('/:id', requireAuth('session'), async (c) => {
    const row = await c
      .get('db')
      .select()
      .from(files)
      .where(
        and(
          eq(files.id, c.req.param('id')),
          eq(files.userId, c.get('auth').user.id)
        )
      )
      .get();

    if (!row) {
      throw notFound();
    }

    const { name } = await openFile(c.env.MASTER_KEY, row);

    return c.json(
      toFileEntry(row, name, publicOrigin(c.env, c.req.url)) satisfies FileEntry
    );
  })
  .delete('/:id', requireAuth('session'), async (c) => {
    const db = c.get('db');
    const row = await db
      .select({ id: files.id })
      .from(files)
      .where(
        and(
          eq(files.id, c.req.param('id')),
          eq(files.userId, c.get('auth').user.id)
        )
      )
      .get();

    if (!row) {
      throw notFound();
    }

    await removeFile(db, c.env.BUCKET, row.id);

    return c.json({ ok: true } satisfies Ok);
  });
