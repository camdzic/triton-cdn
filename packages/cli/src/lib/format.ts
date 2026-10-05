import type { FileEntry } from '@triton/shared';
import { accent, brand, dim, green, yellow } from './theme';

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
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

const relativeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const dateFormat = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short'
});

export function formatBytes(bytes: number) {
  let value = bytes;
  let unit = 0;

  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }

  const digits = unit === 0 || value >= 100 ? 0 : 1;

  return `${value.toFixed(digits)} ${UNITS[unit]}`;
}

export function formatRelative(iso: string) {
  let value = (new Date(iso).getTime() - Date.now()) / 1000;

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

export function truncate(text: string, width: number) {
  if (Bun.stringWidth(text) <= width) {
    return text;
  }

  let result = '';

  for (const char of text) {
    if (Bun.stringWidth(`${result}${char}…`) > width) {
      break;
    }

    result += char;
  }

  return `${result}…`;
}

export function padEnd(text: string, width: number) {
  return `${text}${' '.repeat(Math.max(0, width - Bun.stringWidth(text)))}`;
}

export function isImage(file: FileEntry) {
  return file.contentType.startsWith('image/');
}

export function fileIcon(file: FileEntry) {
  const [kind] = file.contentType.split('/');

  switch (kind) {
    case 'image':
      return brand('▣');
    case 'video':
      return accent('▶');
    case 'audio':
      return green('♪');
    case 'text':
      return yellow('≡');
    default:
      return dim('◇');
  }
}

export function fields(rows: ReadonlyArray<readonly [string, string]>) {
  const width = Math.max(...rows.map(([label]) => label.length));

  return rows
    .map(([label, value]) => `${dim(label.padEnd(width))}  ${value}`)
    .join('\n');
}
