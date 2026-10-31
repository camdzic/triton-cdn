import { GUEST_PATHS, MEMBER_PATHS, SIGNED_IN_COOKIE } from '@triton/shared';
import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

const DEV_SERVER = process.env.TRITON_URL ?? 'http://localhost:8787';

const shared: NextConfig = {
  agentRules: false,
  reactCompiler: true,
  typedRoutes: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css'
      }
    }
  }
};

const SESSION_HINT = { type: 'cookie', key: SIGNED_IN_COOKIE } as const;

const DEV_REDIRECTS = [
  ...MEMBER_PATHS.map((source) => ({
    source,
    missing: [SESSION_HINT],
    destination: '/login',
    permanent: false
  })),
  ...GUEST_PATHS.map((source) => ({
    source,
    has: [SESSION_HINT],
    destination: '/',
    permanent: false
  }))
];

export default function config(phase: string) {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return {
      ...shared,
      redirects() {
        return Promise.resolve(DEV_REDIRECTS);
      },
      rewrites() {
        return Promise.resolve({
          beforeFiles: [],
          afterFiles: [
            { source: '/api/:path*', destination: `${DEV_SERVER}/api/:path*` }
          ],
          fallback: [{ source: '/:file', destination: `${DEV_SERVER}/:file` }]
        });
      }
    };
  }

  return { ...shared, output: 'export' };
}
