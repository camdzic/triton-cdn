import { confirm, log, note, type SelectOptions, select } from '@clack/prompts';
import type { FileEntry } from '@triton/shared';
import type { API } from '../lib/api';
import {
  fields,
  fileIcon,
  formatBytes,
  formatDate,
  formatRelative,
  isImage,
  padEnd,
  truncate
} from '../lib/format';
import { imageProtocol, type Protocol, renderImage } from '../lib/image';
import { ask, orBack, task } from '../lib/prompt';
import { carry, clearScreen, freshScreen, persist } from '../lib/screen';
import { copyToClipboard, openInBrowser } from '../lib/system';
import { terminalSize } from '../lib/terminal';
import { dim, link, red } from '../lib/theme';

const PAGE_SIZE = 15;

type FileAction = 'preview' | 'copy' | 'open' | 'delete' | 'back';

type BrowseChoice =
  | { kind: 'file'; file: FileEntry }
  | { kind: 'page'; offset: number }
  | { kind: 'back' };

function previewProtocol(file: FileEntry) {
  return isImage(file) ? imageProtocol() : Promise.resolve(null);
}

function fileCard(file: FileEntry) {
  return note(
    fields([
      ['Link', link(file.url)],
      ['Type', file.contentType],
      ['Size', formatBytes(file.size)],
      [
        'Uploaded',
        `${formatDate(file.createdAt)} ${dim(`· ${formatRelative(file.createdAt)}`)}`
      ],
      ['ID', dim(file.id)]
    ]),
    `${fileIcon(file)} ${file.name}`
  );
}

export async function showFile(api: API, file: FileEntry) {
  const protocol = await previewProtocol(file);

  if (protocol) {
    const preview = await task('Decrypting preview', async () =>
      renderImage(await api.download(file.url), protocol, {
        indent: `${dim('│')}  `,
        reservedRows: 12
      })
    ).catch(() => null);

    if (preview) {
      process.stdout.write(`${dim('│')}\n${preview}\n`);
    }
  }

  fileCard(file);
}

async function previewScreen(
  file: FileEntry,
  protocol: Protocol,
  load: () => Promise<Uint8Array>
) {
  const preview = await task('Decrypting preview', async () =>
    renderImage(await load(), protocol, { indent: '', reservedRows: 6 })
  ).catch(() => null);

  if (!preview) {
    carry(() => log.warn(`Could not preview ${file.name}`));
    return;
  }

  clearScreen();

  process.stdout.write(`${preview}\n`);

  await orBack(async () =>
    ask(
      await select<'back'>({
        message: dim(file.name),
        options: [{ value: 'back', label: 'Back' }]
      })
    )
  );
}

export async function deleteFile(api: API, file: FileEntry) {
  const sure = ask(
    await confirm({
      message: `Delete ${file.name}? This cannot be undone.`,
      initialValue: false
    })
  );

  if (!sure) {
    return false;
  }

  await task(
    `Deleting ${file.name}`,
    () => api.deleteFile(file.id),
    () => `Deleted ${file.name}`
  );

  return true;
}

export async function fileFlow(api: API, file: FileEntry) {
  const protocol = await previewProtocol(file);

  let image: Promise<Uint8Array> | undefined;

  function load() {
    image ??= api.download(file.url);

    return image;
  }

  while (true) {
    freshScreen();
    fileCard(file);

    const action = ask(
      await select<FileAction>({
        message: 'What next?',
        options: [
          ...(protocol
            ? [{ value: 'preview' as const, label: 'Preview' }]
            : []),
          { value: 'copy', label: 'Copy link' },
          { value: 'open', label: 'Open in browser' },
          { value: 'delete', label: red('Delete') },
          { value: 'back', label: dim('Back') }
        ]
      })
    );

    switch (action) {
      case 'preview':
        if (protocol) {
          await previewScreen(file, protocol, load);
        }

        break;
      case 'copy':
        if (await copyToClipboard(file.url)) {
          persist(() => log.success('Link copied to clipboard'));
        } else {
          persist(() => log.warn(`Clipboard unavailable · ${link(file.url)}`));
        }

        break;
      case 'open':
        openInBrowser(file.url);
        break;
      case 'delete':
        if (await deleteFile(api, file)) {
          return;
        }

        break;
      case 'back':
        return;
    }
  }
}

function fileLabel(file: FileEntry, nameWidth: number) {
  return [
    fileIcon(file),
    padEnd(truncate(file.name, nameWidth), nameWidth),
    dim(formatBytes(file.size).padStart(8)),
    dim(formatRelative(file.createdAt))
  ].join('  ');
}

export async function browseFlow(api: API) {
  let offset = 0;
  while (true) {
    freshScreen();

    const page = await task('Loading uploads', () =>
      api.files(PAGE_SIZE, offset)
    );

    if (page.total === 0) {
      log.info('No uploads yet');
      return;
    }

    if (page.files.length === 0) {
      offset = Math.max(0, offset - PAGE_SIZE);
      continue;
    }

    const nameWidth = Math.max(16, Math.min(44, terminalSize().columns - 40));
    const options: SelectOptions<BrowseChoice>['options'] = page.files.map(
      (file) => ({
        value: { kind: 'file', file },
        label: fileLabel(file, nameWidth)
      })
    );

    if (offset + PAGE_SIZE < page.total) {
      options.push({
        value: { kind: 'page', offset: offset + PAGE_SIZE },
        label: dim('Next page →')
      });
    }

    if (offset > 0) {
      options.push({
        value: { kind: 'page', offset: offset - PAGE_SIZE },
        label: dim('← Previous page')
      });
    }

    options.push({ value: { kind: 'back' }, label: dim('Back') });

    const choice = ask(
      await select<BrowseChoice>({
        message: `Your uploads ${dim(`${offset + 1}–${offset + page.files.length} of ${page.total}`)}`,
        options,
        maxItems: PAGE_SIZE + 3
      })
    );

    switch (choice.kind) {
      case 'file':
        await orBack(() => fileFlow(api, choice.file));
        break;
      case 'page':
        offset = choice.offset;
        break;
      case 'back':
        return;
    }
  }
}
