import { log } from '@clack/prompts';
import { defineCommand } from 'citty';
import packageJson from '../package.json';
import { loginFlow, logoutFlow, registerFlow } from './flows/auth';
import { browseFlow, deleteFile, showFile } from './flows/files';
import { invitesFlow } from './flows/invites';
import { serverFlow, switchServer } from './flows/server';
import { sharexFlow } from './flows/sharex';
import { uploadFiles } from './flows/upload';
import {
  fields,
  formatBytes,
  formatRelative,
  padEnd,
  truncate
} from './lib/format';
import { closeFrame, openFrame, printBlock } from './lib/frame';
import { Cancelled, errorMessage, reportError, task } from './lib/prompt';
import { parseServerUrl } from './lib/server';
import { currentSession, requireSession } from './lib/session';
import { accent, brand, dim, link, red } from './lib/theme';

const DONE = dim('done');

async function framed(work: () => Promise<string>) {
  openFrame();

  try {
    closeFrame(await work());
  } catch (error) {
    reportError(error);

    if (error instanceof Cancelled) {
      closeFrame(dim('Cancelled'));
      return;
    }

    closeFrame(red('Failed'));

    process.exitCode = 1;
  }
}

async function whenSignedOut(start: () => Promise<unknown>) {
  const session = await currentSession();

  if (session) {
    log.warn(
      `You are already logged in as ${brand(session.config.email ?? 'an account')}`
    );

    return `Run ${accent('triton logout')} first to switch accounts`;
  }

  await start();

  return 'Ready to upload';
}

const login = defineCommand({
  meta: { name: 'login', description: 'Log in to your account' },
  run: () => framed(() => whenSignedOut(loginFlow))
});

const register = defineCommand({
  meta: {
    name: 'register',
    description: 'Create an account with an invite code'
  },
  run: () => framed(() => whenSignedOut(registerFlow))
});

const logout = defineCommand({
  meta: { name: 'logout', description: 'Log out on this device' },
  run: () =>
    framed(async () => {
      const session = await currentSession();

      if (session) {
        await logoutFlow(session);
      }

      return session ? DONE : 'You were not logged in';
    })
});

const whoami = defineCommand({
  meta: { name: 'whoami', description: 'Show the current account' },
  run: () =>
    framed(async () => {
      const { api, server } = await requireSession();

      const account = await task('Loading account', () => api.account());

      log.message(
        fields([
          ['Account', brand(account.user.email)],
          ['Role', account.user.role],
          ['Files', String(account.usage.files)],
          ['Storage', formatBytes(account.usage.bytes)],
          ['Server', dim(server)]
        ])
      );
      return DONE;
    })
});

const upload = defineCommand({
  meta: { name: 'upload', description: 'Upload one or more files' },
  args: {
    files: {
      type: 'positional',
      description: 'Files to upload',
      required: true
    }
  },
  run: ({ args }) =>
    framed(async () => {
      const { api } = await requireSession();

      const results = await uploadFiles(api, args._);

      if (results.length < args._.length) {
        process.exitCode = 1;
      }

      return `${results.length} of ${args._.length} uploaded`;
    })
});

const list = defineCommand({
  meta: { name: 'ls', description: 'List your uploads' },
  args: {
    page: { type: 'string', description: 'Page number', default: '1' },
    limit: { type: 'string', description: 'Files per page', default: '25' },
    json: { type: 'boolean', description: 'Print raw JSON' }
  },
  run: async ({ args }) => {
    try {
      const { api } = await requireSession();

      const limit = Math.min(100, Math.max(1, Number(args.limit) || 25));
      const page = Math.max(1, Number(args.page) || 1);

      const result = await api.files(limit, (page - 1) * limit);

      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (result.files.length === 0) {
        printBlock(dim('No uploads on this page'));
        return;
      }

      const nameWidth = Math.min(
        40,
        Math.max(...result.files.map((file) => Bun.stringWidth(file.name)))
      );

      const rows = result.files.map((file) =>
        [
          dim(file.id),
          padEnd(truncate(file.name, nameWidth), nameWidth),
          formatBytes(file.size).padStart(8),
          dim(padEnd(formatRelative(file.createdAt), 14)),
          link(file.url)
        ].join('  ')
      );

      const pages = Math.max(1, Math.ceil(result.total / limit));

      printBlock(
        `${rows.join('\n')}\n\n${dim(`page ${page} of ${pages} · ${result.total} files`)}`
      );
    } catch (error) {
      printBlock(red(errorMessage(error)));
      process.exitCode = 1;
    }
  }
});

const view = defineCommand({
  meta: { name: 'view', description: 'Show a file, with an image preview' },
  args: { id: { type: 'positional', description: 'File ID', required: true } },
  run: ({ args }) =>
    framed(async () => {
      const { api } = await requireSession();

      const file = await task('Loading file', () => api.file(args.id));

      await showFile(api, file);

      return DONE;
    })
});

const remove = defineCommand({
  meta: { name: 'rm', description: 'Delete a file' },
  args: {
    id: { type: 'positional', description: 'File ID', required: true },
    yes: { type: 'boolean', alias: 'y', description: 'Skip confirmation' }
  },
  run: ({ args }) =>
    framed(async () => {
      const { api } = await requireSession();

      const file = await task('Loading file', () => api.file(args.id));

      if (args.yes) {
        await task(
          `Deleting ${file.name}`,
          () => api.deleteFile(file.id),
          () => `Deleted ${file.name}`
        );

        return DONE;
      }

      return (await deleteFile(api, file)) ? DONE : 'Kept the file';
    })
});

const browse = defineCommand({
  meta: { name: 'browse', description: 'Browse uploads interactively' },
  run: () =>
    framed(async () => {
      const { api } = await requireSession();

      await browseFlow(api);

      return DONE;
    })
});

const sharex = defineCommand({
  meta: { name: 'sharex', description: 'Create a ShareX uploader config' },
  run: () =>
    framed(async () => {
      await sharexFlow(await requireSession());

      return DONE;
    })
});

const invites = defineCommand({
  meta: { name: 'invites', description: 'Manage invite codes (admin)' },
  run: () =>
    framed(async () => {
      await invitesFlow(await requireSession());

      return DONE;
    })
});

const server = defineCommand({
  meta: { name: 'server', description: 'Show or change the server' },
  args: {
    url: {
      type: 'positional',
      description: 'Server URL to switch to',
      required: false
    },
    reset: { type: 'boolean', description: 'Switch back to the default server' }
  },
  run: ({ args }) =>
    framed(async () => {
      if (args.reset) {
        return switchServer(null);
      }

      if (args.url) {
        const url = parseServerUrl(args.url);

        if (!url) {
          throw new Error('Enter an http:// or https:// URL');
        }

        return switchServer(url);
      }

      const message = await serverFlow();

      return message === null ? DONE : message;
    })
});

export const cli = defineCommand({
  meta: {
    name: 'triton',
    version: packageJson.version,
    description:
      'Encrypted CDN from your terminal. Run without arguments for the interactive menu.'
  },
  subCommands: {
    login,
    register,
    logout,
    whoami,
    upload,
    ls: list,
    view,
    rm: remove,
    browse,
    sharex,
    invites,
    server
  }
});
