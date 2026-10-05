import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../env';

export function rateLimit(scope: string) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const ip = c.req.header('cf-connecting-ip') ?? 'unknown';

    const { success } = await c.env.AUTH_LIMITER.limit({
      key: `${scope}:${ip}`
    });

    if (!success) {
      throw new HTTPException(429, {
        message: 'Too many attempts, try again in a minute'
      });
    }

    await next();
  });
}
