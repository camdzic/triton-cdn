import { eq, or } from 'drizzle-orm';
import type { Database } from '../db/client';
import { type FileRow, files } from '../db/schema';
import { decryptName, unwrapFileKey } from './envelope';

export function objectKey(id: string) {
  return `files/${id}`;
}

export function findBySlug(db: Database, path: string) {
  const [slug = ''] = path.split('.');

  return db
    .select()
    .from(files)
    .where(or(eq(files.id, slug), eq(files.vanity, slug.toLowerCase())))
    .get();
}

export async function openFile(secret: string, row: FileRow) {
  const key = await unwrapFileKey(secret, row.id, row.wrappedKey);

  return { key, name: await decryptName(key, row.name) };
}

export async function removeFile(db: Database, bucket: R2Bucket, id: string) {
  await bucket.delete(objectKey(id));

  await db.delete(files).where(eq(files.id, id));
}
