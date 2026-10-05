export interface CellSize {
  width: number;
  height: number;
}

export interface TerminalInfo {
  sixel: boolean;
  cell: CellSize;
}

const QUERY_TIMEOUT_MS = 300;
const FALLBACK_CELL: CellSize = { width: 10, height: 20 };
const DEVICE_ATTRIBUTES = /\[\?([\d;]*)c/;
const CELL_SIZE = /\[6;(\d+);(\d+)t/;

function query(sequence: string, terminator: RegExp) {
  return new Promise<string>((resolve) => {
    const { stdin, stdout } = process;

    if (!stdin.isTTY || !stdout.isTTY) {
      resolve('');
      return;
    }

    let response = '';

    const wasRaw = stdin.isRaw;

    function finish() {
      clearTimeout(timer);

      stdin.off('data', onData);
      stdin.setRawMode(wasRaw);
      stdin.pause();

      resolve(response);
    }

    function onData(chunk: Buffer) {
      response += chunk.toString('latin1');

      if (terminator.test(response)) {
        finish();
      }
    }

    const timer = setTimeout(finish, QUERY_TIMEOUT_MS);

    stdin.setRawMode(true);
    stdin.on('data', onData);
    stdin.resume();
    stdout.write(sequence);
  });
}

function parseCell(response: string) {
  const match = CELL_SIZE.exec(response);

  if (!match) {
    return FALLBACK_CELL;
  }

  const [, height, width] = match;

  if (height === undefined || width === undefined) {
    return FALLBACK_CELL;
  }

  const size = { width: Number(width), height: Number(height) };

  return size.width > 0 && size.height > 0 ? size : FALLBACK_CELL;
}

function supportsSixel(response: string) {
  const match = DEVICE_ATTRIBUTES.exec(response);

  if (!match) {
    return false;
  }

  const [, attributes] = match;

  return attributes !== undefined && attributes.split(';').includes('4');
}

const FALLBACK_SIZE = { columns: 80, rows: 24 };

export function terminalSize() {
  return process.stdout.isTTY
    ? { columns: process.stdout.columns, rows: process.stdout.rows }
    : FALLBACK_SIZE;
}

let probe: Promise<TerminalInfo> | undefined;

export function terminalInfo() {
  probe ??= query('\x1b[16t\x1b[c', DEVICE_ATTRIBUTES).then((response) => ({
    sixel: supportsSixel(response),
    cell: parseCell(response)
  }));

  return probe;
}
