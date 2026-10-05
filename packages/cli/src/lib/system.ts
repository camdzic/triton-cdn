import { spawn } from 'node:child_process';

function clipboardCommands() {
  switch (process.platform) {
    case 'win32':
      return [['clip']];
    case 'darwin':
      return [['pbcopy']];
    default:
      return [
        ['wl-copy'],
        ['xclip', '-selection', 'clipboard'],
        ['xsel', '--clipboard', '--input']
      ];
  }
}

function openCommand(url: string) {
  switch (process.platform) {
    case 'win32':
      return ['rundll32', 'url.dll,FileProtocolHandler', url];
    case 'darwin':
      return ['open', url];
    default:
      return ['xdg-open', url];
  }
}

async function run(command: string[], input?: string) {
  try {
    const child = Bun.spawn(command, {
      stdin: input === undefined ? 'ignore' : 'pipe',
      stdout: 'ignore',
      stderr: 'ignore'
    });

    if (input !== undefined && child.stdin) {
      child.stdin.write(input);

      await child.stdin.end();
    }

    return (await child.exited) === 0;
  } catch {
    return false;
  }
}

export async function copyToClipboard(text: string) {
  for (const command of clipboardCommands()) {
    if (await run(command, text)) {
      return true;
    }
  }

  return false;
}

export function openInBrowser(url: string) {
  const [command, ...args] = openCommand(url);

  if (command === undefined) {
    return;
  }

  spawn(command, args, { detached: true, stdio: 'ignore' }).unref();
}
