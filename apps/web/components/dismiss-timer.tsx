'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

const DISMISS_AFTER_MS = 8000;

export function DismissTimer({
  paused,
  onElapsed,
  className
}: {
  paused: boolean;
  onElapsed: () => void;
  className?: string;
}) {
  const remaining = useRef(DISMISS_AFTER_MS);
  const latest = useRef(onElapsed);

  useEffect(() => {
    latest.current = onElapsed;
  }, [onElapsed]);

  useEffect(() => {
    if (paused) {
      return;
    }

    const started = Date.now();
    const timer = setTimeout(() => latest.current(), remaining.current);

    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(
        0,
        remaining.current - (Date.now() - started)
      );
    };
  }, [paused]);

  return (
    <div aria-hidden="true" className={cn('h-0.5 w-full', className)}>
      <div
        className="bg-primary/60 animate-auto-dismiss h-full origin-left"
        style={{
          animationDuration: `${DISMISS_AFTER_MS}ms`,
          animationPlayState: paused ? 'paused' : 'running'
        }}
      />
    </div>
  );
}
