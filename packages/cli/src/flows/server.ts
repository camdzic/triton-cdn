import { confirm, log, select, text } from '@clack/prompts';
import { API } from '../lib/api';
import { type Config, loadConfig, saveConfig } from '../lib/config';
import { fields } from '../lib/format';
import { ask, task, validator } from '../lib/prompt';
import { freshScreen } from '../lib/screen';
import { defaultServer, parseServerUrl, serverUrlSchema } from '../lib/server';
import { brand, dim, green, red, yellow } from '../lib/theme';

type ServerAction = 'change' | 'reset' | 'back';

async function status(server: string) {
  try {
    const result = await new API(server).probe();

    return result.triton
      ? green(`online · ${result.ms} ms`)
      : yellow('reachable, but not a triton server');
  } catch {
    return red('unreachable');
  }
}

async function describe(config: Config) {
  const fallback = defaultServer();
  const current = config.server ?? fallback;

  const rows: Array<readonly [string, string]> = [
    ['Server', current ? brand(current) : dim('not set')],
    ['Source', config.server ? 'custom' : 'default']
  ];

  if (config.server && fallback) {
    rows.push(['Default', dim(fallback)]);
  }

  if (current) {
    rows.push(['Status', await task('Checking server', () => status(current))]);
  }

  rows.push([
    'Account',
    config.token && config.email ? brand(config.email) : dim('not logged in')
  ]);

  log.message(fields(rows));
}

async function looksLikeTriton(server: string) {
  try {
    const result = await task(`Checking ${server}`, () =>
      new API(server).probe()
    );

    return result.triton;
  } catch {
    return false;
  }
}

export async function switchServer(next: string | null) {
  const config = await loadConfig();
  const fallback = defaultServer();
  const current = config.server ?? fallback;
  const target = next ?? fallback;

  if (!target) {
    throw new Error('This build of triton has no default server');
  }

  if (target === current) {
    return `Already using ${target}`;
  }

  if (!(await looksLikeTriton(target))) {
    const anyway = ask(
      await confirm({
        message: `${target} does not look like a triton server. Use it anyway?`,
        initialValue: false
      })
    );

    if (!anyway) {
      return current ? `Still using ${current}` : 'No server set';
    }
  }

  const token = config.token;

  if (token && current) {
    const sure = ask(
      await confirm({
        message: `Switching servers logs you out of ${config.email ?? 'your account'}. Continue?`,
        initialValue: false
      })
    );

    if (!sure) {
      return `Still using ${current}`;
    }

    await task('Signing out', () =>
      new API(current, token).logout().catch(() => null)
    );
  }

  await saveConfig({ server: target === fallback ? undefined : target });

  return `Now using ${target}`;
}

export async function serverFlow() {
  freshScreen();

  const config = await loadConfig();
  const fallback = defaultServer();

  await describe(config);

  const action = ask(
    await select<ServerAction>({
      message: 'Server',
      options: [
        { value: 'change', label: 'Change server' },
        ...(config.server && fallback
          ? [
              {
                value: 'reset' as const,
                label: 'Use the default server',
                hint: fallback
              }
            ]
          : []),
        { value: 'back', label: dim('Back') }
      ]
    })
  );

  if (action === 'reset') {
    return switchServer(null);
  }

  if (action === 'back') {
    return null;
  }

  const input = ask(
    await text({
      message: 'Server URL',
      placeholder: 'https://cdn.example.com',
      validate: validator(serverUrlSchema)
    })
  );

  const url = parseServerUrl(input);

  if (!url) {
    throw new Error('Enter an http:// or https:// URL');
  }

  return switchServer(url);
}
