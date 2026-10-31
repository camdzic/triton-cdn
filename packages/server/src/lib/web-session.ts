import {
  SESSION_COOKIE,
  SIGNED_IN_COOKIE,
  WEB_CLIENT,
  WEB_CLIENT_HEADER
} from '@triton/shared';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppEnv } from '../env';
import { SESSION_TTL_MS } from './sessions';

function secure(c: Context<AppEnv>) {
  return new URL(c.req.url).protocol === 'https:';
}

function sessionCookieOptions(c: Context<AppEnv>) {
  return {
    path: '/',
    httpOnly: true,
    secure: secure(c),
    sameSite: 'Strict'
  } as const;
}

function hintCookieOptions(c: Context<AppEnv>) {
  return {
    path: '/',
    httpOnly: false,
    secure: secure(c),
    sameSite: 'Lax'
  } as const;
}

export function isWebClient(c: Context<AppEnv>) {
  return c.req.header(WEB_CLIENT_HEADER) === WEB_CLIENT;
}

export function sessionCookie(c: Context<AppEnv>) {
  const token = getCookie(c, SESSION_COOKIE);

  return token === undefined || token === '' ? null : token;
}

export function webSessionToken(c: Context<AppEnv>) {
  return isWebClient(c) ? sessionCookie(c) : null;
}

const MAX_AGE = SESSION_TTL_MS / 1000;

export function setSignedInHint(c: Context<AppEnv>) {
  setCookie(c, SIGNED_IN_COOKIE, '1', {
    ...hintCookieOptions(c),
    maxAge: MAX_AGE
  });
}

export function setSessionCookie(c: Context<AppEnv>, token: string) {
  setCookie(c, SESSION_COOKIE, token, {
    ...sessionCookieOptions(c),
    maxAge: MAX_AGE
  });
  setSignedInHint(c);
}

export function clearSessionCookie(c: Context<AppEnv>) {
  deleteCookie(c, SESSION_COOKIE, sessionCookieOptions(c));
  deleteCookie(c, SIGNED_IN_COOKIE, hintCookieOptions(c));
}
