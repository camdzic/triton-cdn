const FALLBACK = 'application/octet-stream';
const MIME_PATTERN =
  /^[a-z0-9][a-z0-9!#$&^_.+-]{0,63}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,63}$/;
const GENERIC_TYPES = new Set([
  FALLBACK,
  'application/x-www-form-urlencoded',
  'multipart/form-data'
]);
const ATTACHMENT_TYPES = new Set([
  'text/html',
  'application/xhtml+xml',
  'text/javascript',
  'application/javascript',
  'application/x-msdownload'
]);

const EXTENSION_TYPES = new Map([
  ['apng', 'image/apng'],
  ['avif', 'image/avif'],
  ['bmp', 'image/bmp'],
  ['gif', 'image/gif'],
  ['ico', 'image/x-icon'],
  ['jpeg', 'image/jpeg'],
  ['jpg', 'image/jpeg'],
  ['png', 'image/png'],
  ['svg', 'image/svg+xml'],
  ['webp', 'image/webp'],
  ['mp4', 'video/mp4'],
  ['webm', 'video/webm'],
  ['mov', 'video/quicktime'],
  ['mp3', 'audio/mpeg'],
  ['ogg', 'audio/ogg'],
  ['wav', 'audio/wav'],
  ['flac', 'audio/flac'],
  ['pdf', 'application/pdf'],
  ['json', 'application/json'],
  ['txt', 'text/plain'],
  ['md', 'text/markdown'],
  ['csv', 'text/csv'],
  ['zip', 'application/zip'],
  ['gz', 'application/gzip'],
  ['tar', 'application/x-tar'],
  ['7z', 'application/x-7z-compressed']
]);

function extensionOf(filename: string) {
  const dot = filename.lastIndexOf('.');

  return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
}

function essenceOf(header: string) {
  const end = header.indexOf(';');

  return (end === -1 ? header : header.slice(0, end)).trim().toLowerCase();
}

function fromExtension(filename: string) {
  const type = EXTENSION_TYPES.get(extensionOf(filename));

  return type === undefined ? FALLBACK : type;
}

export function resolveContentType(
  header: string | undefined,
  filename: string
) {
  if (header === undefined) {
    return fromExtension(filename);
  }

  const essence = essenceOf(header);

  return MIME_PATTERN.test(essence) && !GENERIC_TYPES.has(essence)
    ? essence
    : fromExtension(filename);
}

export function servedContentType(contentType: string) {
  return contentType.startsWith('text/')
    ? `${contentType}; charset=utf-8`
    : contentType;
}

export function contentDisposition(contentType: string, filename: string) {
  const mode = ATTACHMENT_TYPES.has(contentType) ? 'attachment' : 'inline';
  const ascii = filename.replace(/[^\x20-\x7e]|["\\]/g, '_');

  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
