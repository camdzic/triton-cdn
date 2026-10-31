import { existsSync } from 'node:fs';
import { join } from 'node:path';

const WEB_DIR = join(import.meta.dir, '..', '..', '..', 'apps', 'web');

export function buildWeb() {
  return Bun.spawn([process.execPath, 'run', 'build'], {
    cwd: WEB_DIR,
    stdio: ['inherit', 'inherit', 'inherit']
  }).exited;
}

if (import.meta.main && !existsSync(join(WEB_DIR, 'out'))) {
  process.exitCode = await buildWeb();
}
