import {
  concatBytes,
  decodeBase64,
  decodeText,
  encodeBase64,
  encodeText
} from './encoding';
import { masterKeyBytes } from './master-key';
import { randomBytes } from './random';

const AES_GCM = 'AES-GCM';
const IV_BYTES = 12;
const NAME_IV = Uint8Array.of(1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

const masterKeys = new Map<string, Promise<CryptoKey>>();

function importMasterKey(secret: string) {
  const cached = masterKeys.get(secret);

  if (cached) {
    return cached;
  }

  const key = crypto.subtle.importKey(
    'raw',
    masterKeyBytes(secret),
    AES_GCM,
    false,
    ['wrapKey', 'unwrapKey']
  );

  masterKeys.set(secret, key);

  return key;
}

function wrapParams(iv: Uint8Array, fileId: string) {
  return {
    name: AES_GCM,
    iv,
    additionalData: encodeText(fileId)
  };
}

export interface FileKey {
  key: CryptoKey;
  wrapped: string;
}

export async function createFileKey(secret: string, fileId: string) {
  const master = await importMasterKey(secret);

  const key = await crypto.subtle.importKey(
    'raw',
    randomBytes(32),
    AES_GCM,
    true,
    ['encrypt', 'decrypt']
  );

  const iv = randomBytes(IV_BYTES);

  const wrapped = await crypto.subtle.wrapKey(
    'raw',
    key,
    master,
    wrapParams(iv, fileId)
  );

  return {
    key,
    wrapped: encodeBase64(concatBytes(iv, new Uint8Array(wrapped)))
  };
}

export async function unwrapFileKey(
  secret: string,
  fileId: string,
  wrapped: string
) {
  const master = await importMasterKey(secret);
  const bytes = decodeBase64(wrapped);

  return crypto.subtle.unwrapKey(
    'raw',
    bytes.subarray(IV_BYTES),
    master,
    wrapParams(bytes.subarray(0, IV_BYTES), fileId),
    AES_GCM,
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptName(key: CryptoKey, name: string) {
  return encodeBase64(
    new Uint8Array(
      await crypto.subtle.encrypt(
        { name: AES_GCM, iv: NAME_IV },
        key,
        encodeText(name)
      )
    )
  );
}

export async function decryptName(key: CryptoKey, encrypted: string) {
  return decodeText(
    new Uint8Array(
      await crypto.subtle.decrypt(
        { name: AES_GCM, iv: NAME_IV },
        key,
        decodeBase64(encrypted)
      )
    )
  );
}
