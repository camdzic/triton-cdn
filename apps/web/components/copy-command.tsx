'use client';

import { CopyIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notify } from '@/lib/activity';
import { copyText } from '@/lib/browser';

export function CopyCommand({ command }: { command: string }) {
  return (
    <div className="bg-muted/60 ring-foreground/10 flex items-center gap-2 rounded-lg py-1 pr-1 pl-3 ring-1">
      <code className="min-w-0 flex-1 font-mono text-xs break-all">
        <span className="text-muted-foreground select-none">$ </span>
        {command}
      </code>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Copy command"
        onClick={() => {
          void copyText(command).then((copied) => {
            if (copied) {
              notify.success('Command copied');
            } else {
              notify.error('Clipboard unavailable');
            }
          });
        }}
      >
        <CopyIcon />
      </Button>
    </div>
  );
}
