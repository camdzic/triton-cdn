import { hostname } from 'node:os';
import type { Session as AuthSession } from '@triton/shared';
import { API, APIError } from './api';
import { type Config, loadConfig, saveConfig } from './config';
import { serverUrl } from './server';

export interface Session {
  api: API;
  server: string;
  config: Config;
}

export function deviceName() {
  return `CLI · ${hostname()}`.slice(0, 64);
}

export async function currentSession() {
  const config = await loadConfig();

  if (!config.token) {
    return null;
  }

  const server = serverUrl();

  return { api: new API(server, config.token), server, config };
}

export async function requireSession() {
  const session = await currentSession();

  if (!session) {
    throw new APIError('You are not logged in', 401);
  }

  return session;
}

export async function persistSession(auth: AuthSession) {
  const server = serverUrl();

  const config: Config = { token: auth.token, email: auth.user.email };

  await saveConfig(config);

  return { api: new API(server, auth.token), server, config };
}

export async function forgetSession(session: Session) {
  await saveConfig({ email: session.config.email });
}
