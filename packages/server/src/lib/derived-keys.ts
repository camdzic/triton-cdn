import { encodeText } from './encoding';
import { masterKeyBytes } from './master-key';

const SALT = new Uint8Array(32);

const derivedKeys = new Map<string, Promise<CryptoKey>>();

export function derivedKey(
  secret: string,
  purpose: string,
  algorithm: SubtleCryptoImportKeyAlgorithm,
  usages: string[]
) {
  const cacheKey = `${purpose}\n${secret}`;

  const cached = derivedKeys.get(cacheKey);

  if (cached) {
    return cached;
  }

  const key = crypto.subtle
    .importKey('raw', masterKeyBytes(secret), 'HKDF', false, ['deriveKey'])
    .then((material) =>
      crypto.subtle.deriveKey(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: SALT,
          info: encodeText(`triton/${purpose}`)
        },
        material,
        algorithm,
        false,
        usages
      )
    );

  derivedKeys.set(cacheKey, key);

  return key;
}
