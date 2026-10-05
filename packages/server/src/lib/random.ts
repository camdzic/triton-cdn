const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const UNBIASED_LIMIT = 256 - (256 % ALPHABET.length);

export function randomBytes(length: number) {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function randomId(length: number) {
  let result = '';

  while (result.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte < UNBIASED_LIMIT && result.length < length) {
        result += ALPHABET[byte % ALPHABET.length];
      }
    }
  }

  return result;
}

export function randomSecret(prefix = '') {
  return `${prefix}${randomId(40)}`;
}
