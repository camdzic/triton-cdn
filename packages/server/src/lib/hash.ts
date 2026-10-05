import { encodeHex, encodeText } from './encoding';

export async function sha256Hex(value: string) {
  return encodeHex(
    new Uint8Array(await crypto.subtle.digest('SHA-256', encodeText(value)))
  );
}

export function safeEqual(left: string, right: string) {
  const a = encodeText(left);
  const b = encodeText(right);

  return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);
}
