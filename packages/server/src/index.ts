import type { APIError } from '@triton/shared';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createDatabase } from './db/client';
import type { AppEnv } from './env';
import { accountRoutes } from './routes/account';
import { authRoutes } from './routes/auth';
import { fileRoutes } from './routes/files';
import { inviteRoutes } from './routes/invites';
import { publicRoutes } from './routes/public';

const app = new Hono<AppEnv>()
  .use(async (c, next) => {
    c.set('db', createDatabase(c.env.DB));

    await next();
  })
  .route('/api/auth', authRoutes)
  .route('/api/me', accountRoutes)
  .route('/api/files', fileRoutes)
  .route('/api/invites', inviteRoutes)
  .route('/', publicRoutes);

app.notFound((c) => c.json({ error: 'Not found' } satisfies APIError, 404));

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ error: error.message } satisfies APIError, error.status);
  }

  console.error(error);

  return c.json({ error: 'Internal server error' } satisfies APIError, 500);
});

export default app;
