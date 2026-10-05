import { isCancel, log, spinner } from '@clack/prompts';
import type { z } from 'zod';
import { APIError } from './api';
import { carry } from './screen';
import { dim } from './theme';

export class Cancelled extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'Cancelled';
  }
}

function isAnswer<T>(value: T): value is Exclude<T, symbol> {
  return !isCancel(value);
}

export function ask<T>(value: T) {
  if (isAnswer(value)) {
    return value;
  }

  throw new Cancelled();
}

export function validator(schema: z.ZodType) {
  return (value: string | undefined) => {
    const result = schema.safeParse(value === undefined ? '' : value);

    if (result.success) {
      return undefined;
    }

    const [issue] = result.error.issues;

    return issue ? issue.message : 'Invalid value';
  };
}

const ERASE_PREVIOUS_LINE = '\x1b[1A\x1b[2K';

function vanish(indicator: ReturnType<typeof spinner>) {
  indicator.clear();

  if (process.stdout.isTTY) {
    process.stdout.write(ERASE_PREVIOUS_LINE);
  }
}

export async function task<T>(
  message: string,
  work: () => Promise<T>,
  done?: (result: T) => string
) {
  const indicator = spinner();

  indicator.start(message);

  try {
    const result = await work();

    if (done) {
      const summary = done(result);

      indicator.stop(summary);

      carry(() => log.step(summary));
    } else {
      vanish(indicator);
    }

    return result;
  } catch (error) {
    vanish(indicator);

    throw error;
  }
}

export async function orBack<T>(work: () => Promise<T>) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof Cancelled) {
      return null;
    }

    throw error;
  }
}

export function errorMessage(error: unknown) {
  if (error instanceof APIError && error.status === 401) {
    return `${error.message} ${dim('· run')} triton login`;
  }

  return error instanceof Error ? error.message : String(error);
}

export function reportError(error: unknown) {
  if (!(error instanceof Cancelled)) {
    log.error(errorMessage(error));
  }
}
