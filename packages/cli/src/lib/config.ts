import { chmod, mkdir, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

const configSchema = z.object({
  token: z.string().optional(),
  email: z.string().optional()
});

export type Config = z.infer<typeof configSchema>;

function configDir() {
  if (process.env.TRITON_CONFIG_DIR) {
    return process.env.TRITON_CONFIG_DIR;
  }

  if (process.platform === 'win32') {
    return join(
      process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'),
      'triton'
    );
  }

  return join(
    process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'),
    'triton'
  );
}

function configPath() {
  return join(configDir(), 'config.json');
}

export async function loadConfig() {
  const file = Bun.file(configPath());

  if (!(await file.exists())) {
    return {};
  }

  const parsed = configSchema.safeParse(await file.json().catch(() => null));

  return parsed.success ? parsed.data : {};
}

export async function saveConfig(config: Config) {
  await mkdir(configDir(), { recursive: true });

  await Bun.write(configPath(), `${JSON.stringify(config, null, 2)}\n`);

  if (process.platform !== 'win32') {
    await chmod(configPath(), 0o600);
  }
}

export function clearConfig() {
  return rm(configPath(), { force: true });
}
