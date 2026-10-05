import sharp, { type Sharp } from 'sharp';
import { type CellSize, terminalInfo, terminalSize } from './terminal';

export type Protocol = 'kitty' | 'iterm' | 'sixel';

interface CellBox {
  columns: number;
  rows: number;
}

interface Bitmap {
  pixels: Buffer;
  width: number;
  height: number;
}

const ESC = '\x1b';
const KITTY_CHUNK = 4096;
const ALPHA_THRESHOLD = 128;
const SIXEL_COLORS = 255;
const TRANSPARENT = -1;
const PROTOCOLS: readonly Protocol[] = ['kitty', 'iterm', 'sixel'];

function isProtocol(value: string | undefined): value is Protocol {
  return PROTOCOLS.some((protocol) => protocol === value);
}

async function detectProtocol() {
  const { TERM, TERM_PROGRAM, KITTY_WINDOW_ID, TRITON_IMAGE_PROTOCOL } =
    process.env;

  if (TRITON_IMAGE_PROTOCOL === 'none') {
    return null;
  }

  if (isProtocol(TRITON_IMAGE_PROTOCOL)) {
    return TRITON_IMAGE_PROTOCOL;
  }

  if (KITTY_WINDOW_ID || TERM === 'xterm-kitty' || TERM_PROGRAM === 'ghostty') {
    return 'kitty';
  }

  if (
    TERM_PROGRAM === 'iTerm.app' ||
    TERM_PROGRAM === 'WezTerm' ||
    TERM_PROGRAM === 'mintty'
  ) {
    return 'iterm';
  }

  return (await terminalInfo()).sixel ? 'sixel' : null;
}

let detected: Promise<Protocol | null> | undefined;

export function imageProtocol() {
  detected ??= detectProtocol();

  return detected;
}

function fitCells(
  width: number,
  height: number,
  cell: CellSize,
  maxColumns: number,
  maxRows: number
) {
  const aspect = (height / width) * (cell.width / cell.height);
  const columns = Math.max(
    1,
    Math.min(maxColumns, Math.round(maxRows / aspect), width)
  );

  return { columns, rows: Math.max(1, Math.round(columns * aspect)) };
}

async function toBitmap(image: Sharp) {
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { pixels: data, width: info.width, height: info.height };
}

function kitty(png: Buffer, box: CellBox) {
  const payload = png.toString('base64');
  const chunks: string[] = [];

  for (let offset = 0; offset < payload.length; offset += KITTY_CHUNK) {
    const more = offset + KITTY_CHUNK < payload.length ? 1 : 0;
    const control =
      offset === 0
        ? `a=T,f=100,q=2,c=${box.columns},r=${box.rows},m=${more}`
        : `m=${more}`;

    chunks.push(
      `${ESC}_G${control};${payload.slice(offset, offset + KITTY_CHUNK)}${ESC}\\`
    );
  }

  return chunks.join('');
}

function iterm(png: Buffer, box: CellBox) {
  return `${ESC}]1337;File=inline=1;size=${png.byteLength};width=${box.columns};height=${box.rows};preserveAspectRatio=1:${png.toString('base64')}\x07`;
}

function sixelRow(bits: Buffer) {
  let row = '';
  let previous = -1;
  let run = 0;

  function flush() {
    if (run === 0) {
      return;
    }

    const char = String.fromCharCode(63 + previous);

    row += run > 3 ? `!${run}${char}` : char.repeat(run);
  }

  for (const value of bits) {
    if (value === previous) {
      run += 1;
      continue;
    }

    flush();

    previous = value;
    run = 1;
  }

  flush();

  return row;
}

function sixel({ pixels, width, height }: Bitmap) {
  const pixelCount = width * height;
  const palette = new Map<number, number>();
  const indices = Buffer.alloc(pixelCount * 2);
  const definitions: string[] = [];

  function percent(channel: number) {
    return Math.round((channel / 255) * 100);
  }

  for (let offset = 0; offset < pixelCount; offset += 1) {
    const base = offset * 4;

    if (pixels.readUInt8(base + 3) < ALPHA_THRESHOLD) {
      indices.writeInt16LE(TRANSPARENT, offset * 2);
      continue;
    }

    const r = pixels.readUInt8(base);
    const g = pixels.readUInt8(base + 1);
    const b = pixels.readUInt8(base + 2);
    const key = (r << 16) | (g << 8) | b;

    let color = palette.get(key);

    if (color === undefined) {
      color = palette.size;
      palette.set(key, color);
      definitions.push(`#${color};2;${percent(r)};${percent(g)};${percent(b)}`);
    }

    indices.writeInt16LE(color, offset * 2);
  }

  const bands: string[] = [];

  for (let top = 0; top < height; top += 6) {
    const rows = new Map<number, Buffer>();

    for (let bit = 0; bit < 6 && top + bit < height; bit += 1) {
      const start = (top + bit) * width;

      for (let x = 0; x < width; x += 1) {
        const color = indices.readInt16LE((start + x) * 2);

        if (color === TRANSPARENT) {
          continue;
        }

        let row = rows.get(color);

        if (!row) {
          row = Buffer.alloc(width);
          rows.set(color, row);
        }

        row.writeUInt8(row.readUInt8(x) | (1 << bit), x);
      }
    }

    bands.push(
      [...rows].map(([color, bits]) => `#${color}${sixelRow(bits)}`).join('$')
    );
  }

  return `${ESC}P0;1;0q"1;1;${width};${height}${definitions.join('')}${bands.join('-')}${ESC}\\`;
}

export interface ImageLayout {
  indent: string;
  reservedRows: number;
}

export async function renderImage(
  data: Uint8Array,
  protocol: Protocol,
  { indent, reservedRows }: ImageLayout
) {
  const { cell } = await terminalInfo();

  const terminal = terminalSize();
  const image = sharp(data, { animated: false }).rotate();

  const { width = 1, height = 1 } = await image.metadata();

  const maxColumns = Math.max(
    10,
    terminal.columns - Bun.stringWidth(indent) - 2
  );
  const maxRows = Math.max(4, terminal.rows - reservedRows);
  const box = fitCells(width, height, cell, maxColumns, maxRows);
  const target = image.resize({
    width: Math.min(width, box.columns * cell.width),
    height: Math.min(height, box.rows * cell.height),
    fit: 'inside',
    withoutEnlargement: true
  });

  if (protocol === 'sixel') {
    const quantized = await target
      .png({ palette: true, colors: SIXEL_COLORS, dither: 0.6 })
      .toBuffer();

    return `${indent}${sixel(await toBitmap(sharp(quantized)))}`;
  }

  const png = await target.png().toBuffer();

  return `${indent}${protocol === 'kitty' ? kitty(png, box) : iterm(png, box)}`;
}
