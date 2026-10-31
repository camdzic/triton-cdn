import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

function hueOf(username: string) {
  let hash = 0;

  for (const char of username) {
    const code = char.codePointAt(0);

    if (code !== undefined) {
      hash = (hash * 31 + code) % 360;
    }
  }

  return hash;
}

function initialOf(username: string) {
  const [first = '?'] = Array.from(username.trim());

  return first.toUpperCase();
}

export function UserAvatar({
  username,
  className
}: {
  username: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ '--avatar-hue': hueOf(username) } as CSSProperties}
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(135deg,oklch(0.62_0.16_var(--avatar-hue)),oklch(0.52_0.17_calc(var(--avatar-hue)+40)))] text-sm font-semibold text-white shadow-sm ring-1 ring-black/5 select-none dark:bg-[linear-gradient(135deg,oklch(0.7_0.14_var(--avatar-hue)),oklch(0.58_0.16_calc(var(--avatar-hue)+40)))] dark:ring-white/10',
        className
      )}
    >
      {initialOf(username)}
    </span>
  );
}
