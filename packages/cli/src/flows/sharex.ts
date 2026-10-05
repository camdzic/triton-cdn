import { hostname } from 'node:os';
import { note, text } from '@clack/prompts';
import { z } from 'zod';
import { fields } from '../lib/format';
import { ask, task, validator } from '../lib/prompt';
import { freshScreen, persist } from '../lib/screen';
import type { Session } from '../lib/session';
import { sharexConfig, sharexFileName } from '../lib/sharex';
import {
  importIntoSharex,
  saveToProject,
  sharexExecutable
} from '../lib/sharex-install';

const nameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(64, 'Name must be at most 64 characters');

export async function sharexFlow(session: Session) {
  freshScreen();

  const name = ask(
    await text({
      message: 'Name this ShareX config',
      initialValue: `ShareX · ${hostname()}`,
      validate: validator(nameSchema)
    })
  ).trim();

  const { token } = await task('Preparing config', () =>
    session.api.uploadToken()
  );

  const config = sharexConfig(session.server, token, name);

  const contents = `${JSON.stringify(config, null, 2)}\n`;

  const fileName = sharexFileName(name);

  const executable = await sharexExecutable();

  if (executable !== null) {
    await importIntoSharex(executable, fileName, contents);

    const summary = fields([
      ['Uploader', config.Name],
      ['ShareX', 'Imported, confirm in ShareX if it asks to make it default']
    ]);

    persist(() => note(summary, 'Added to ShareX'));

    return;
  }

  const path = await saveToProject(fileName, contents);

  const summary = fields([
    ['File', path],
    ['ShareX', 'Not found on this computer, import the file manually']
  ]);

  persist(() => note(summary, 'ShareX config saved'));
}
