import { readdir, rename, rm } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';

const OUT_DIR = join(import.meta.dirname, '..', 'out');
const SEGMENT_PREFIX = '__next.';

async function files(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);

      return entry.isDirectory() ? files(path) : Promise.resolve([path]);
    })
  );

  return nested.flat();
}

async function segmentDirs(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === '_next') {
      continue;
    }

    const path = join(dir, entry.name);

    if (entry.name.startsWith(SEGMENT_PREFIX)) {
      found.push(path);
    } else {
      found.push(...(await segmentDirs(path)));
    }
  }

  return found;
}

for (const segmentDir of await segmentDirs(OUT_DIR)) {
  for (const file of await files(segmentDir)) {
    const flat = relative(dirname(segmentDir), file).split(sep).join('.');

    await rename(file, join(dirname(segmentDir), flat));
  }

  await rm(segmentDir, { recursive: true });
}
