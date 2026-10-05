import { concatBytes } from './encoding';

const CHUNK_SIZE = 256 * 1024;
const TAG_SIZE = 16;
const SEALED_CHUNK_SIZE = CHUNK_SIZE + TAG_SIZE;

type Controller = TransformStreamDefaultController<Uint8Array>;

function chunkCount(size: number) {
  return Math.max(1, Math.ceil(size / CHUNK_SIZE));
}

function chunkParams(index: number, final: boolean) {
  const iv = new Uint8Array(12);

  new DataView(iv.buffer).setUint32(8, index);

  return { name: 'AES-GCM', iv, additionalData: Uint8Array.of(final ? 1 : 0) };
}

export function sealedSize(size: number) {
  return size + chunkCount(size) * TAG_SIZE;
}

export function encryptStream(key: CryptoKey, size: number) {
  const finalIndex = chunkCount(size) - 1;

  let pending = new Uint8Array(0);
  let index = 0;
  let received = 0;

  async function seal(chunk: Uint8Array, controller: Controller) {
    const sealed = await crypto.subtle.encrypt(
      chunkParams(index, index === finalIndex),
      key,
      chunk
    );

    controller.enqueue(new Uint8Array(sealed));

    index += 1;
  }

  return new TransformStream<Uint8Array, Uint8Array>({
    async transform(input, controller) {
      received += input.byteLength;

      if (received > size) {
        throw new Error('Body is longer than Content-Length');
      }

      pending = concatBytes(pending, input);

      while (index < finalIndex && pending.byteLength >= CHUNK_SIZE) {
        await seal(pending.subarray(0, CHUNK_SIZE), controller);

        pending = pending.subarray(CHUNK_SIZE);
      }
    },

    async flush(controller) {
      if (received !== size) {
        throw new Error('Body is shorter than Content-Length');
      }

      await seal(pending, controller);
    }
  });
}

export interface ByteRange {
  start: number;
  length: number;
}

export interface SealedSlice {
  offset: number;
  length: number;
  decrypt: () => TransformStream<Uint8Array, Uint8Array>;
}

export function sealedSlice(key: CryptoKey, size: number, range: ByteRange) {
  const finalIndex = chunkCount(size) - 1;
  const firstIndex = Math.floor(range.start / CHUNK_SIZE);
  const lastIndex =
    range.length === 0
      ? firstIndex
      : Math.floor((range.start + range.length - 1) / CHUNK_SIZE);
  const offset = firstIndex * SEALED_CHUNK_SIZE;
  const length =
    Math.min(sealedSize(size), (lastIndex + 1) * SEALED_CHUNK_SIZE) - offset;

  function decrypt() {
    let pending = new Uint8Array(0);
    let index = firstIndex;
    let skip = range.start - firstIndex * CHUNK_SIZE;
    let remaining = range.length;

    async function open(chunk: Uint8Array, controller: Controller) {
      const plain = new Uint8Array(
        await crypto.subtle.decrypt(
          chunkParams(index, index === finalIndex),
          key,
          chunk
        )
      );

      const slice = plain.subarray(skip, skip + remaining);

      if (slice.byteLength > 0) {
        controller.enqueue(slice);
      }

      remaining -= slice.byteLength;
      skip = 0;
      index += 1;
    }

    return new TransformStream<Uint8Array, Uint8Array>({
      async transform(input, controller) {
        pending = concatBytes(pending, input);

        while (index < lastIndex && pending.byteLength >= SEALED_CHUNK_SIZE) {
          await open(pending.subarray(0, SEALED_CHUNK_SIZE), controller);

          pending = pending.subarray(SEALED_CHUNK_SIZE);
        }
      },
      async flush(controller) {
        await open(pending, controller);
      }
    });
  }

  return { offset, length, decrypt };
}
