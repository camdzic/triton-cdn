'use client';

import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useStoredState<Value extends string>(
  key: string,
  allowed: readonly Value[],
  fallback: Value
) {
  const stored = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null
  );

  const value = allowed.find((option) => option === stored);

  function set(next: Value) {
    try {
      localStorage.setItem(key, next);
    } catch {
      return;
    }

    for (const listener of listeners) {
      listener();
    }
  }

  return [value === undefined ? fallback : value, set] as const;
}
