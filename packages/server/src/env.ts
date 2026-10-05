import type { Database } from './db/client';
import type { UserRow } from './db/schema';

export interface Bindings {
  DB: D1Database;
  BUCKET: R2Bucket;
  AUTH_LIMITER: RateLimit;
  MASTER_KEY: string;
  BOOTSTRAP_CODE: string;
  MAX_UPLOAD_BYTES: string;
  TRITON_URL?: string;
}

export type AuthContext =
  | { kind: 'session'; user: UserRow; sessionId: string }
  | { kind: 'upload'; user: UserRow };

export interface AppEnv {
  Bindings: Bindings;
  Variables: {
    db: Database;
    auth: AuthContext;
  };
}
