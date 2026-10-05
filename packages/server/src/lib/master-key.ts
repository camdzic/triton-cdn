import { decodeBase64 } from './encoding';

export function masterKeyBytes(secret: string) {
  const raw = decodeBase64(secret);

  if (raw.byteLength !== 32) {
    throw new Error('MASTER_KEY must be 32 bytes encoded as base64');
  }

  return raw;
}
