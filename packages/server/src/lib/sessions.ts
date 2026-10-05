import { SESSION_TOKEN_PREFIX, UPLOAD_TOKEN_PREFIX } from '@triton/shared';
import type { Database } from '../db/client';
import { tokens } from '../db/schema';
import { sha256Hex } from './hash';
import { randomId, randomSecret } from './random';

const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export type TokenKind = 'session' | 'upload';

export function tokenKindOf(token: string) {
  if (token.startsWith(SESSION_TOKEN_PREFIX)) {
    return 'session';
  }

  if (token.startsWith(UPLOAD_TOKEN_PREFIX)) {
    return 'upload';
  }

  return null;
}

export async function issueSession(db: Database, userId: string, name: string) {
  const token = randomSecret(SESSION_TOKEN_PREFIX);
  const now = Date.now();

  await db.insert(tokens).values({
    id: randomId(16),
    userId,
    name,
    hash: await sha256Hex(token),
    createdAt: new Date(now),
    expiresAt: new Date(now + SESSION_TTL_MS)
  });

  return token;
}
