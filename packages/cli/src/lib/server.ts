import { z } from 'zod';
import type { Config } from './config';

export const serverUrlSchema = z.url({
  protocol: /^https?$/,
  error: 'Enter an http:// or https:// URL'
});

export function parseServerUrl(value: string) {
  const result = serverUrlSchema.safeParse(value.trim());

  return result.success ? new URL(result.data).origin : null;
}

export function defaultServer() {
  return parseServerUrl(process.env.TRITON_URL ?? '');
}

export function serverUrl(config: Config) {
  const server = config.server ?? defaultServer();

  if (!server) {
    throw new Error('No server is set. Run triton server <url> to choose one.');
  }

  return server;
}
