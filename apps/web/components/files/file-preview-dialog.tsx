'use client';

import { useQuery } from '@tanstack/react-query';
import type { FileEntry } from '@triton/shared';
import {
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  GlobeIcon,
  LockIcon,
  PencilIcon,
  Trash2Icon
} from 'lucide-react';
import Image from 'next/image';
import { type ReactNode, useRef } from 'react';
import { RelativeTime } from '@/components/relative-time';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
import { fileKind, formatBytes } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  copyLink,
  downloadFile,
  type FileIntent,
  useToggleAccess
} from './file-actions';
import { FileBadge, filePath } from './file-visual';

const TEXT_PREVIEW_BYTES = 64 * 1024;

async function loadText(file: FileEntry) {
  const response = await fetch(filePath(file), {
    headers: { range: `bytes=0-${TEXT_PREVIEW_BYTES - 1}` }
  });

  if (!response.ok) {
    throw new Error(`Preview failed with ${response.status}`);
  }

  return response.text();
}

function TextPreview({ file }: { file: FileEntry }) {
  const text = useQuery({
    queryKey: ['preview', file.id],
    queryFn: () => loadText(file),
    staleTime: Number.POSITIVE_INFINITY
  });

  if (text.isPending) {
    return (
      <div className="flex w-full flex-col gap-2 p-4">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    );
  }

  if (text.isError) {
    return <Unavailable file={file} />;
  }

  return (
    <pre className="max-h-[55vh] w-full overflow-auto p-4 text-left font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
      {text.data}
      {file.size > TEXT_PREVIEW_BYTES ? (
        <span className="text-muted-foreground block pt-3">
          … preview truncated at {formatBytes(TEXT_PREVIEW_BYTES)}
        </span>
      ) : null}
    </pre>
  );
}

function Unavailable({ file }: { file: FileEntry }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <FileBadge file={file} className="size-14 rounded-2xl [&_svg]:size-7" />
      <p className="text-muted-foreground text-sm">
        No preview for this file type.
      </p>
    </div>
  );
}

function Preview({ file }: { file: FileEntry }) {
  const path = filePath(file);

  switch (fileKind(file)) {
    case 'image':
      return (
        <Image
          draggable={false}
          src={path}
          alt={file.name}
          width={0}
          height={0}
          sizes="(min-width: 768px) 768px, 100vw"
          className="h-auto max-h-[60vh] w-auto max-w-full object-contain"
        />
      );
    case 'video':
      return (
        <video
          draggable={false}
          src={path}
          controls
          playsInline
          className="max-h-[60vh] w-full bg-black"
        />
      );
    case 'audio':
      return (
        <div className="w-full p-6">
          <audio src={path} controls className="w-full" />
        </div>
      );
    case 'text':
      return <TextPreview file={file} />;
    default:
      return <Unavailable file={file} />;
  }
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="truncate text-sm">{children}</dd>
    </div>
  );
}

export function FilePreviewDialog({
  file,
  open,
  onOpenChange,
  onIntent
}: {
  file: FileEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIntent: (file: FileEntry, intent: FileIntent) => void;
}) {
  const copyButton = useRef<HTMLButtonElement>(null);
  const toggleAccess = useToggleAccess();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        initialFocus={copyButton}
        className="max-h-[calc(100svh-2rem)] grid-cols-[minmax(0,1fr)] gap-0 overflow-y-auto p-0 sm:max-w-3xl"
      >
        {file === null ? null : (
          <>
            <DialogHeader className="flex-row items-center gap-3 border-b p-4 pr-12">
              <FileBadge file={file} />
              <div className="min-w-0">
                <DialogTitle className="truncate">{file.name}</DialogTitle>
                <DialogDescription className="truncate">
                  {formatBytes(file.size)} · {file.contentType}
                </DialogDescription>
              </div>
            </DialogHeader>
            <div
              className={cn(
                'flex min-h-48 items-center justify-center overflow-hidden',
                fileKind(file) === 'image' ? 'bg-checker' : 'bg-muted/40'
              )}
            >
              <div className="flex w-full items-center justify-center">
                <Preview file={file} />
              </div>
            </div>
            <div className="flex flex-col gap-4 border-t p-4">
              <InputGroup>
                <InputGroupInput
                  readOnly
                  value={file.url}
                  aria-label="File link"
                  className="font-mono text-xs"
                  onFocus={(event) => event.currentTarget.select()}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-sm"
                    aria-label="Custom link"
                    title="Custom link"
                    onClick={() => onIntent(file, 'link')}
                  >
                    <PencilIcon />
                  </InputGroupButton>
                  <InputGroupButton
                    size="icon-sm"
                    aria-label={file.private ? 'Make public' : 'Make private'}
                    title={file.private ? 'Make public' : 'Make private'}
                    onClick={() => toggleAccess(file)}
                  >
                    {file.private ? <GlobeIcon /> : <LockIcon />}
                  </InputGroupButton>
                  <InputGroupButton
                    size="icon-sm"
                    aria-label="Copy link"
                    title="Copy link"
                    onClick={() => void copyLink(file)}
                  >
                    <CopyIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
                <Detail label="Access">
                  {file.private ? 'Private' : 'Public'}
                </Detail>
                <Detail label="Size">{formatBytes(file.size)}</Detail>
                <Detail label="Type">{file.contentType}</Detail>
                <Detail label="Uploaded">
                  <RelativeTime iso={file.createdAt} />
                </Detail>
                <Detail label="ID">
                  <span className="font-mono">{file.id}</span>
                </Detail>
              </dl>
            </div>
            <DialogFooter className="m-0 flex-col-reverse gap-2 rounded-b-xl border-t p-4 sm:flex-row sm:justify-between">
              <Button
                variant="destructive"
                onClick={() => onIntent(file, 'delete')}
              >
                <Trash2Icon />
                Delete
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => downloadFile(file)}>
                  <DownloadIcon />
                  Download
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(file.url, '_blank', 'noopener')}
                >
                  <ExternalLinkIcon />
                  Open
                </Button>
                <Button ref={copyButton} onClick={() => void copyLink(file)}>
                  <CopyIcon />
                  Copy link
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
