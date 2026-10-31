'use client';

import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

function centeredOffset(element: HTMLElement) {
  const parent = element.parentElement;

  if (parent === null) {
    return 0;
  }

  const style = getComputedStyle(parent);
  const top = parent.getBoundingClientRect().top + window.scrollY;
  const available =
    window.innerHeight -
    top -
    Number.parseFloat(style.paddingTop) -
    Number.parseFloat(style.paddingBottom);

  return Math.max(0, Math.round((available - element.offsetHeight) / 2));
}

export function AuthCard({
  title,
  description,
  footer,
  children
}: {
  title: string;
  description: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState<number | null>(null);

  useLayoutEffect(() => {
    function place() {
      if (container.current !== null) {
        setOffset(centeredOffset(container.current));
      }
    }

    place();

    const observer = new ResizeObserver(place);

    observer.observe(document.documentElement);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={container}
      style={offset === null ? undefined : { marginTop: offset }}
      className={cn('w-full max-w-sm', offset === null && 'self-center')}
    >
      <Card className="shadow-xl shadow-black/5 dark:shadow-black/30">
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      <div className="text-muted-foreground mt-5 text-center text-sm">
        {footer}
      </div>
    </div>
  );
}
