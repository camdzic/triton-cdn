'use client';

import { useSyncExternalStore } from 'react';
import { formatDate, formatRelative } from '@/lib/format';

const TICK_MS = 30_000;

let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (timer === null) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();

      for (const notify of listeners) {
        notify();
      }
    }, TICK_MS);
  }

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function snapshot() {
  return now;
}

export function RelativeTime({
  iso,
  prefix
}: {
  iso: string;
  prefix?: string;
}) {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  const text = formatRelative(iso, current);

  return (
    <time dateTime={iso} title={formatDate(iso)}>
      {prefix === undefined ? text : `${prefix} ${text}`}
    </time>
  );
}
