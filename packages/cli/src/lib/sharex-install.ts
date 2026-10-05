import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const OPEN_COMMAND_KEYS = [
  'HKCU\\Software\\Classes\\ShareX.sxcu\\shell\\open\\command',
  'HKLM\\Software\\Classes\\ShareX.sxcu\\shell\\open\\command'
];
const EXECUTABLE = /"([^"]+\.exe)"/i;
const STAGING = join(tmpdir(), 'triton-sharex');

async function registeredExecutable(key: string) {
  try {
    const output = await Bun.$`reg query ${key} /ve`.quiet().text();

    const match = EXECUTABLE.exec(output);

    if (!match) {
      return null;
    }

    const [, executable] = match;

    return executable === undefined ? null : executable;
  } catch {
    return null;
  }
}

export async function sharexExecutable() {
  if (process.platform !== 'win32') {
    return null;
  }

  for (const key of OPEN_COMMAND_KEYS) {
    const executable = await registeredExecutable(key);

    if (executable !== null && (await Bun.file(executable).exists())) {
      return executable;
    }
  }

  return null;
}

export async function importIntoSharex(
  executable: string,
  fileName: string,
  contents: string
) {
  await rm(STAGING, { recursive: true, force: true });

  await mkdir(STAGING, { recursive: true });

  const path = join(STAGING, fileName);

  await Bun.write(path, contents);

  spawn(executable, ['-CustomUploader', path], {
    detached: true,
    stdio: 'ignore'
  }).unref();
}

async function isWorkspaceRoot(dir: string) {
  const manifest = Bun.file(join(dir, 'package.json'));

  if (!(await manifest.exists())) {
    return false;
  }

  const parsed: unknown = await manifest.json().catch(() => null);

  return (
    typeof parsed === 'object' && parsed !== null && 'workspaces' in parsed
  );
}

async function projectRoot() {
  let dir = import.meta.dir;

  while (true) {
    if (await isWorkspaceRoot(dir)) {
      return dir;
    }

    const parent = dirname(dir);

    if (parent === dir) {
      return process.cwd();
    }

    dir = parent;
  }
}

export async function saveToProject(fileName: string, contents: string) {
  const folder = join(await projectRoot(), 'sharex');

  await mkdir(folder, { recursive: true });

  const path = join(folder, fileName);

  await Bun.write(path, contents);

  return path;
}
