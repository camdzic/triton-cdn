'use client';

import type { FileEntry } from '@triton/shared';
import {
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  GlobeIcon,
  LinkIcon,
  LockIcon,
  MoreHorizontalIcon,
  Trash2Icon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { notify } from '@/lib/activity';
import { errorMessage } from '@/lib/api';
import { copyText } from '@/lib/browser';
import { useUpdateFile } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { filePath } from './file-visual';

export type FileIntent = 'preview' | 'link' | 'delete';

export async function copyLink(file: FileEntry) {
  if (await copyText(file.url)) {
    notify.success('Link copied', file.url);
  } else {
    notify.error('Clipboard unavailable', file.url);
  }
}

export function downloadFile(file: FileEntry) {
  const anchor = document.createElement('a');

  anchor.href = filePath(file);
  anchor.download = file.name;
  anchor.click();
}

export function useToggleAccess() {
  const update = useUpdateFile();

  return function toggle(file: FileEntry) {
    update.mutate(
      { id: file.id, input: { private: !file.private } },
      {
        onSuccess(updated) {
          notify.success(
            updated.private ? 'File is now private' : 'File is now public',
            updated.name
          );
        },
        onError(error) {
          notify.error('Could not change access', errorMessage(error));
        }
      }
    );
  };
}

export function FileActionsMenu({
  file,
  onIntent,
  className
}: {
  file: FileEntry;
  onIntent: (file: FileEntry, intent: FileIntent) => void;
  className?: string;
}) {
  const toggleAccess = useToggleAccess();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${file.name}`}
            className={cn('data-popup-open:bg-muted', className)}
          />
        }
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => onIntent(file, 'preview')}>
          <EyeIcon />
          Preview
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void copyLink(file)}>
          <CopyIcon />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => window.open(file.url, '_blank', 'noopener')}
        >
          <ExternalLinkIcon />
          Open in new tab
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadFile(file)}>
          <DownloadIcon />
          Download
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onIntent(file, 'link')}>
          <LinkIcon />
          Custom link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggleAccess(file)}>
          {file.private ? <GlobeIcon /> : <LockIcon />}
          {file.private ? 'Make public' : 'Make private'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onIntent(file, 'delete')}
        >
          <Trash2Icon />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
