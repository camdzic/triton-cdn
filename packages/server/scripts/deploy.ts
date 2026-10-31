import { join } from 'node:path';
import { buildWeb } from './web';

const SERVER_DIR = join(import.meta.dir, '..');

function domain() {
  const value = process.env.TRITON_URL;

  if (value === undefined || value === '') {
    throw new Error('Set TRITON_URL in the root .env before deploying');
  }

  return new URL(value).host;
}

const host = domain();

const built = await buildWeb();

if (built === 0) {
  const deploy = Bun.spawn(
    [
      process.execPath,
      'x',
      'wrangler',
      'deploy',
      '--minify',
      '--domain',
      host,
      ...process.argv.slice(2)
    ],
    { cwd: SERVER_DIR, stdio: ['inherit', 'inherit', 'inherit'] }
  );

  process.exitCode = await deploy.exited;
} else {
  process.exitCode = built;
}
