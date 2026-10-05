import type { ByteRange } from './stream-cipher';

const RANGE_PATTERN = /^bytes=(\d*)-(\d*)$/;

export type RangeResult =
  | { kind: 'full' }
  | { kind: 'partial'; range: ByteRange }
  | { kind: 'unsatisfiable' };

const FULL: RangeResult = { kind: 'full' };
const UNSATISFIABLE: RangeResult = { kind: 'unsatisfiable' };

function suffixRange(length: number, size: number): RangeResult {
  const clamped = Math.min(length, size);

  return clamped === 0
    ? UNSATISFIABLE
    : { kind: 'partial', range: { start: size - clamped, length: clamped } };
}

function boundedRange(start: number, end: string, size: number): RangeResult {
  const last = end === '' ? size - 1 : Math.min(Number(end), size - 1);

  return start >= size || last < start
    ? UNSATISFIABLE
    : { kind: 'partial', range: { start, length: last - start + 1 } };
}

export function parseRange(
  header: string | undefined,
  size: number
): RangeResult {
  if (header === undefined || size === 0) {
    return FULL;
  }

  const match = RANGE_PATTERN.exec(header.trim());

  if (!match) {
    return FULL;
  }

  const [, start, end] = match;

  if (
    start === undefined ||
    end === undefined ||
    (start === '' && end === '')
  ) {
    return FULL;
  }

  return start === ''
    ? suffixRange(Number(end), size)
    : boundedRange(Number(start), end, size);
}
