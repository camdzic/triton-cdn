import { stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { log, note, progress } from '@clack/prompts';
import type { FileEntry } from '@triton/shared';
import { type API, APIError } from '../lib/api';
import { pickFile } from '../lib/file-picker';
import { formatBytes } from '../lib/format';
import { errorMessage } from '../lib/prompt';
import { carry, freshScreen, persist } from '../lib/screen';
import { copyToClipboard } from '../lib/system';
import { dim, link } from '../lib/theme';

async function isFile(target: string) {
  try {
    const info = await stat(target);

    return info.isFile();
  } catch {
    return false;
  }
}

async function uploadOne(api: API, target: string) {
  const name = basename(target);

  const size = Bun.file(target).size;

  const bar = progress({ style: 'heavy', max: Math.max(1, size) });

  let reported = 0;

  bar.start(`Uploading ${name}`);

  try {
    const result = await api.upload(target, (sent) => {
      bar.advance(
        sent - reported,
        `Uploading ${name} ${dim(`${formatBytes(sent)} / ${formatBytes(size)}`)}`
      );

      reported = sent;
    });

    const summary = `${name} ${dim(`· ${formatBytes(result.size)} · encrypted`)}`;

    bar.stop(summary);

    carry(() => log.step(summary));

    return result;
  } catch (error) {
    bar.error(`${name} failed`);

    throw error;
  }
}

export async function uploadFiles(api: API, targets: readonly string[]) {
  const results: FileEntry[] = [];

  for (const target of targets.map((value) => resolve(value))) {
    if (!(await isFile(target))) {
      const message = `Not a file: ${target}`;

      persist(() => log.error(message));

      continue;
    }

    try {
      results.push(await uploadOne(api, target));
    } catch (error) {
      if (error instanceof APIError && error.status === 401) {
        throw error;
      }

      persist(() => log.error(errorMessage(error)));
    }
  }

  if (results.length > 0) {
    const links = results.map((result) => link(result.url)).join('\n');

    persist(() => note(links, 'Links'));

    const copied = await copyToClipboard(
      results.map((result) => result.url).join('\n')
    );

    if (copied) {
      const message =
        results.length === 1
          ? 'Link copied to clipboard'
          : 'Links copied to clipboard';

      persist(() => log.success(message));
    }
  }

  return results;
}

export async function uploadFlow(api: API) {
  const target = await pickFile(process.cwd());

  if (target === null) {
    return;
  }

  freshScreen();

  await uploadFiles(api, [target]);
}
