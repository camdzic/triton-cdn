import { derivedKey } from './derived-keys';
import {
  concatBytes,
  decodeBase64,
  decodeText,
  encodeBase64,
  encodeText
} from './encoding';
import { randomBytes } from './random';

const IV_BYTES = 12;

function sealingKey(secret: string) {
  return derivedKey(
    secret,
    'sealed-text/v1',
    { name: 'AES-GCM', length: 256 },
    ['encrypt', 'decrypt']
  );
}

export async function sealText(secret: string, value: string, context: string) {
  const iv = randomBytes(IV_BYTES);

  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encodeText(context) },
    await sealingKey(secret),
    encodeText(value)
  );

  return encodeBase64(concatBytes(iv, new Uint8Array(sealed)));
}

export async function openText(
  secret: string,
  sealed: string,
  context: string
) {
  const bytes = decodeBase64(sealed);

  const plain = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: bytes.subarray(0, IV_BYTES),
      additionalData: encodeText(context)
    },
    await sealingKey(secret),
    bytes.subarray(IV_BYTES)
  );

  return decodeText(new Uint8Array(plain));
}
