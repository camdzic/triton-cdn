import { decodeBase64, encodeBase64, encodeText } from './encoding';
import { randomBytes } from './random';

const ALGORITHM = 'pbkdf2-sha256';
const ITERATIONS = 100_000;
const KEY_BITS = 256;
const SALT_BYTES = 16;

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey(
    'raw',
    encodeText(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    KEY_BITS
  );

  return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(SALT_BYTES);
  const hash = await derive(password, salt, ITERATIONS);

  return [ALGORITHM, ITERATIONS, encodeBase64(salt), encodeBase64(hash)].join(
    '$'
  );
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, iterations, salt, hash] = stored.split('$');

  if (algorithm !== ALGORITHM || !iterations || !salt || !hash) {
    return false;
  }

  const expected = decodeBase64(hash);
  const actual = await derive(password, decodeBase64(salt), Number(iterations));

  return (
    actual.byteLength === expected.byteLength &&
    crypto.subtle.timingSafeEqual(actual, expected)
  );
}

let decoyHash: Promise<string> | undefined;

export async function verifyDecoy(password: string) {
  decoyHash ??= hashPassword(crypto.randomUUID());

  await verifyPassword(password, await decoyHash);

  return false;
}
