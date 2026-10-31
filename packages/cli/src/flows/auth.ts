import { log, password, text } from '@clack/prompts';
import { loginInputSchema, registerInputSchema } from '@triton/shared';
import type { z } from 'zod';
import { API } from '../lib/api';
import { loadConfig } from '../lib/config';
import { ask, task, validator } from '../lib/prompt';
import { freshScreen } from '../lib/screen';
import { serverUrl } from '../lib/server';
import {
  deviceName,
  forgetSession,
  persistSession,
  type Session
} from '../lib/session';
import { brand, dim } from '../lib/theme';

async function usernamePrompt(schema: z.ZodType, initialValue?: string) {
  return ask(
    await text({
      message: 'Username',
      placeholder: 'your-name',
      initialValue,
      validate: validator(schema)
    })
  );
}

export async function loginFlow() {
  const config = await loadConfig();

  freshScreen();

  const server = serverUrl(config);

  log.info(`Signing in to ${dim(server)}`);

  const username = await usernamePrompt(
    loginInputSchema.shape.username,
    config.username
  );

  const secret = ask(
    await password({
      message: 'Password',
      validate: validator(loginInputSchema.shape.password)
    })
  );

  const auth = await task(
    'Signing in',
    () =>
      new API(server).login({
        username,
        password: secret,
        device: deviceName()
      }),
    (result) => `Signed in as ${brand(result.user.username)}`
  );

  return persistSession(auth);
}

export async function registerFlow() {
  const config = await loadConfig();

  freshScreen();

  const server = serverUrl(config);

  log.info(`Creating an account on ${dim(server)}`);

  const username = await usernamePrompt(registerInputSchema.shape.username);

  const secret = ask(
    await password({
      message: 'Password',
      validate: validator(registerInputSchema.shape.password)
    })
  );

  ask(
    await password({
      message: 'Confirm password',
      validate: (value) =>
        value === secret ? undefined : 'Passwords do not match'
    })
  );

  const invite = ask(
    await text({
      message: 'Invite code',
      placeholder: 'XXXX-XXXX-XXXX-XXXX',
      validate: validator(registerInputSchema.shape.invite)
    })
  );

  const auth = await task(
    'Creating your account',
    () => new API(server).register({ username, password: secret, invite }),
    (result) =>
      `Welcome, ${brand(result.user.username)}${result.user.role === 'admin' ? dim(' · admin') : ''}`
  );

  return persistSession(auth);
}

export async function logoutFlow(session: Session) {
  await task(
    'Signing out',
    () => session.api.logout().catch(() => null),
    () => 'Signed out'
  );

  await forgetSession(session);
}
