import { UPLOAD_TOKEN_PREFIX } from '@triton/shared';
import { derivedKey } from './derived-keys';
import { decodeBase64Url, encodeBase64Url, encodeText } from './encoding';

function signingKey(secret: string) {
  return derivedKey(
    secret,
    'upload-token/v1',
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    ['sign', 'verify']
  );
}

export async function uploadTokenFor(secret: string, userId: string) {
  const signature = await crypto.subtle.sign(
    'HMAC',
    await signingKey(secret),
    encodeText(userId)
  );

  return `${UPLOAD_TOKEN_PREFIX}${userId}.${encodeBase64Url(new Uint8Array(signature))}`;
}

function decodeSignature(value: string) {
  try {
    return decodeBase64Url(value);
  } catch {
    return null;
  }
}

export async function verifyUploadToken(secret: string, token: string) {
  const [userId, encoded] = token.slice(UPLOAD_TOKEN_PREFIX.length).split('.');
  const signature = encoded ? decodeSignature(encoded) : null;

  if (!userId || !signature) {
    return null;
  }

  const valid = await crypto.subtle.verify(
    'HMAC',
    await signingKey(secret),
    signature,
    encodeText(userId)
  );

  return valid ? userId : null;
}
