import { z } from 'zod';

const serverUrlSchema = z.url({ protocol: /^https?$/ });

export function serverUrl() {
  const result = serverUrlSchema.safeParse(process.env.TRITON_URL);

  if (!result.success) {
    throw new Error(
      'This build of triton has no server. Set TRITON_URL in the root .env and rebuild the CLI.'
    );
  }

  return result.data.replace(/\/+$/, '');
}
