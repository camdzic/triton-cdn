import type { FileEntry } from '@triton/shared';

export { formatBytes } from '@triton/shared';

const RELATIVE_STEPS: ReadonlyArray<
  readonly [number, Intl.RelativeTimeFormatUnit]
> = [
  [60, 'second'],
  [60, 'minute'],
  [24, 'hour'],
  [7, 'day'],
  [4.345, 'week'],
  [12, 'month'],
  [Number.POSITIVE_INFINITY, 'year']
];

const JUST_NOW_SECONDS = 45;

const relativeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const dateFormat = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short'
});
const dayFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

export function formatRelative(iso: string, now: number) {
  let value = (new Date(iso).getTime() - now) / 1000;

  if (Math.abs(value) < JUST_NOW_SECONDS) {
    return relativeFormat.format(0, 'second');
  }

  for (const [step, unit] of RELATIVE_STEPS) {
    if (Math.abs(value) < step) {
      return relativeFormat.format(Math.round(value), unit);
    }

    value /= step;
  }

  return dateFormat.format(new Date(iso));
}

export function formatDate(iso: string) {
  return dateFormat.format(new Date(iso));
}

export function formatDay(iso: string) {
  return dayFormat.format(new Date(iso));
}

export function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export type FileKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'text'
  | 'pdf'
  | 'archive'
  | 'other';

const ARCHIVE_TYPES = new Set([
  'application/zip',
  'application/x-7z-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/gzip',
  'application/x-tar'
]);

const TEXT_TYPES = new Set([
  'application/json',
  'application/xml',
  'application/javascript',
  'application/x-sh',
  'application/toml',
  'application/yaml'
]);

export function fileKind(file: FileEntry): FileKind {
  const [type = ''] = file.contentType.split(';');
  const [family] = type.trim().split('/');

  if (family === 'image' || family === 'video' || family === 'audio') {
    return family;
  }

  if (family === 'text' || TEXT_TYPES.has(type)) {
    return 'text';
  }

  if (type === 'application/pdf') {
    return 'pdf';
  }

  if (ARCHIVE_TYPES.has(type)) {
    return 'archive';
  }

  return 'other';
}

export function extensionOf(name: string) {
  const dot = name.lastIndexOf('.');

  return dot > 0 && dot < name.length - 1
    ? name.slice(dot + 1).toUpperCase()
    : '';
}
