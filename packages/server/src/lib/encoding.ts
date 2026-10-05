const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function encodeText(value: string) {
  return textEncoder.encode(value);
}

export function decodeText(bytes: Uint8Array) {
  return textDecoder.decode(bytes);
}

export function encodeBase64(bytes: Uint8Array) {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

export function decodeBase64(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

export function encodeHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  );
}

export function concatBytes(left: Uint8Array, right: Uint8Array) {
  const result = new Uint8Array(left.byteLength + right.byteLength);

  result.set(left, 0);
  result.set(right, left.byteLength);

  return result;
}

export function encodeBase64Url(bytes: Uint8Array) {
  return encodeBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function decodeBase64Url(value: string) {
  return decodeBase64(value.replace(/-/g, '+').replace(/_/g, '/'));
}
