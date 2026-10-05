import { eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { files, invites, tokens, users } from '../db/schema';
import { objectKey } from './stored-files';

const R2_DELETE_BATCH = 1000;

export async function removeAccount(
  db: Database,
  bucket: R2Bucket,
  userId: string
) {
  const owned = await db
    .select({ id: files.id })
    .from(files)
    .where(eq(files.userId, userId))
    .all();

  for (let start = 0; start < owned.length; start += R2_DELETE_BATCH) {
    await bucket.delete(
      owned.slice(start, start + R2_DELETE_BATCH).map(({ id }) => objectKey(id))
    );
  }

  await db.batch([
    db.delete(invites).where(eq(invites.usedBy, userId)),
    db.delete(invites).where(eq(invites.createdBy, userId)),
    db.delete(files).where(eq(files.userId, userId)),
    db.delete(tokens).where(eq(tokens.userId, userId)),
    db.delete(users).where(eq(users.id, userId))
  ]);

  return owned.length;
}
