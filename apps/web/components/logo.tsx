import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'bg-gradient-brand flex size-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm',
        className
      )}
    >
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
        <path
          d="M12 2.5 21.5 12 12 21.5 2.5 12Z"
          fill="currentColor"
          fillOpacity="0.35"
        />
        <path d="M12 6.5 17.5 12 12 17.5 6.5 12Z" fill="currentColor" />
      </svg>
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="font-semibold tracking-tight">triton</span>
        <span className="text-muted-foreground text-xs">encrypted cdn</span>
      </span>
    </span>
  );
}
