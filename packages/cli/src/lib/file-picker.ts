import type { Dirent } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { autocomplete, type SelectOptions } from '@clack/prompts';
import { formatBytes } from './format';
import { ask } from './prompt';
import { freshScreen } from './screen';
import { brand, dim } from './theme';

type Entry =
  | { kind: 'back' }
  | { kind: 'up' }
  | { kind: 'folder'; path: string }
  | { kind: 'file'; path: string };

function byName(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

async function folderEntries(folder: string) {
  try {
    return await readdir(folder, { withFileTypes: true });
  } catch {
    return [] satisfies Dirent[];
  }
}

async function fileSize(path: string) {
  try {
    const info = await stat(path);

    return formatBytes(info.size);
  } catch {
    return '';
  }
}

async function folderOptions(folder: string) {
  const entries = await folderEntries(folder);

  const folders = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(byName);

  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort(byName);

  const sizes = await Promise.all(
    files.map((name) => fileSize(join(folder, name)))
  );

  const options: SelectOptions<Entry>['options'] = [
    { value: { kind: 'back' }, label: dim('Back') }
  ];

  if (dirname(folder) !== folder) {
    options.push({ value: { kind: 'up' }, label: '..', hint: dirname(folder) });
  }

  for (const name of folders) {
    options.push({
      value: { kind: 'folder', path: join(folder, name) },
      label: `${brand('▸')} ${name}/`
    });
  }

  for (const [index, name] of files.entries()) {
    options.push({
      value: { kind: 'file', path: join(folder, name) },
      label: name,
      hint: sizes[index]
    });
  }

  return options;
}

export async function pickFile(start: string) {
  let folder = start;

  while (true) {
    freshScreen();

    const choice = ask(
      await autocomplete<Entry>({
        message: `Pick a file to upload ${dim(folder)}`,
        placeholder: 'Type to search',
        maxItems: 15,
        options: await folderOptions(folder)
      })
    );

    switch (choice.kind) {
      case 'back':
        return null;
      case 'up':
        folder = dirname(folder);
        break;
      case 'folder':
        folder = choice.path;
        break;
      case 'file':
        return choice.path;
    }
  }
}
