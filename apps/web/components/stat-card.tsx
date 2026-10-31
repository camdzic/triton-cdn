import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  icon: Icon,
  className
}: {
  label: string;
  value: ReactNode | null;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <Card size="sm" className={cn('relative overflow-hidden', className)}>
      <div className="flex items-center gap-3 px-3 lg:gap-4 lg:px-4">
        <span className="bg-primary/10 text-primary ring-primary/15 flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 lg:size-12">
          <Icon className="size-5 lg:size-6" />
        </span>
        <div className="min-w-0">
          <p className="text-muted-foreground truncate text-xs font-medium tracking-wide uppercase">
            {label}
          </p>
          <div className="mt-1 truncate text-xl font-semibold tracking-tight tabular-nums sm:text-2xl lg:text-xl xl:text-2xl">
            {value === null ? (
              <Skeleton className="my-1 h-5 w-20 sm:h-6" />
            ) : (
              value
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
