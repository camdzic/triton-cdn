'use client';

import type { FileEntry } from '@triton/shared';
import { RelativeTime } from '@/components/relative-time';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBytes } from '@/lib/format';
import { cn } from '@/lib/utils';
import { FileActionsMenu, type FileIntent } from './file-actions';
import { FileBadge, FileThumbnail, PrivateMark } from './file-visual';

interface ViewProps {
  files: readonly FileEntry[];
  onIntent: (file: FileEntry, intent: FileIntent) => void;
}

export function FileGrid({ files, onIntent }: ViewProps) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {files.map((file) => (
        <li
          key={file.id}
          className="group/file bg-card ring-foreground/10 hover:ring-primary/40 relative flex flex-col overflow-hidden rounded-xl shadow-xs ring-1 transition-shadow hover:shadow-md"
        >
          <button
            type="button"
            className="bg-muted relative aspect-[4/3] w-full overflow-hidden focus-visible:outline-none"
            aria-label={`Preview ${file.name}`}
            onClick={() => onIntent(file, 'preview')}
          >
            <FileThumbnail file={file} />
            {file.private ? (
              <span className="bg-background/85 absolute top-2 right-2 flex size-6 items-center justify-center rounded-md shadow-xs">
                <PrivateMark />
              </span>
            ) : null}
          </button>
          <div className="flex items-center gap-1 py-2 pr-1.5 pl-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={file.name}>
                {file.name}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                <span className="hidden min-[420px]:inline md:hidden lg:inline">
                  {formatBytes(file.size)} ·{' '}
                </span>
                <RelativeTime iso={file.createdAt} />
              </p>
            </div>
            <FileActionsMenu file={file} onIntent={onIntent} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const LIST_COLUMNS = {
  type: 'hidden w-48 truncate lg:block',
  size: 'hidden w-16 text-right tabular-nums sm:block lg:w-20',
  uploaded: 'hidden w-24 text-right sm:block lg:w-32'
};

function FileListHeader() {
  return (
    <div className="bg-card text-muted-foreground sticky top-14 z-10 hidden items-center gap-3 rounded-t-xl border-b py-2.5 pr-2 pl-3 text-xs font-medium tracking-wide uppercase sm:flex">
      <span className="w-9 shrink-0" />
      <span className="flex-1">Name</span>
      <span className={LIST_COLUMNS.type}>Type</span>
      <span className={LIST_COLUMNS.size}>Size</span>
      <span className={LIST_COLUMNS.uploaded}>Uploaded</span>
      <span className="w-7 shrink-0" />
    </div>
  );
}

export function FileList({ files, onIntent }: ViewProps) {
  return (
    <div className="bg-card ring-foreground/10 rounded-xl ring-1">
      <FileListHeader />
      <ul className="divide-y">
        {files.map((file) => (
          <li
            key={file.id}
            className="hover:bg-muted/50 flex items-center gap-3 py-2 pr-2 pl-3 transition-colors first:rounded-t-xl last:rounded-b-xl sm:first:rounded-t-none"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
              onClick={() => onIntent(file, 'preview')}
            >
              <FileBadge file={file} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">
                    {file.name}
                  </span>
                  {file.private ? (
                    <PrivateMark className="text-muted-foreground" />
                  ) : null}
                </span>
                <span className="text-muted-foreground block truncate text-xs sm:hidden">
                  {formatBytes(file.size)} ·{' '}
                  <RelativeTime iso={file.createdAt} />
                </span>
              </span>
              <span
                className={cn(
                  LIST_COLUMNS.type,
                  'text-muted-foreground text-sm'
                )}
              >
                {file.contentType}
              </span>
              <span
                className={cn(
                  LIST_COLUMNS.size,
                  'text-muted-foreground text-sm'
                )}
              >
                {formatBytes(file.size)}
              </span>
              <span
                className={cn(
                  LIST_COLUMNS.uploaded,
                  'text-muted-foreground text-sm'
                )}
              >
                <RelativeTime iso={file.createdAt} />
              </span>
            </button>
            <FileActionsMenu file={file} onIntent={onIntent} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const SKELETON_KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export function FileGridSkeleton({ className }: { className?: string }) {
  return (
    <ul
      aria-hidden="true"
      className={cn(
        'grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
        className
      )}
    >
      {SKELETON_KEYS.map((key) => (
        <li
          key={key}
          className="ring-foreground/10 overflow-hidden rounded-xl ring-1"
        >
          <Skeleton className="aspect-[4/3] rounded-none" />
          <div className="py-2 pr-1.5 pl-3">
            <div className="flex h-5 items-center">
              <Skeleton className="h-3.5 w-3/4" />
            </div>
            <div className="flex h-4 items-center">
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function FileListSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('bg-card ring-foreground/10 rounded-xl ring-1', className)}
    >
      <FileListHeader />
      <ul className="divide-y">
        {SKELETON_KEYS.map((key) => (
          <li key={key} className="flex items-center gap-3 py-2 pr-2 pl-3">
            <Skeleton className="size-9 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <div className="flex h-5 items-center">
                <Skeleton className="h-3.5 w-40 max-w-full" />
              </div>
              <div className="flex h-4 items-center sm:hidden">
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className={cn(LIST_COLUMNS.type, 'h-5')}>
              <Skeleton className="mt-0.5 h-3.5 w-24" />
            </div>
            <div className={cn(LIST_COLUMNS.size, 'h-5')}>
              <Skeleton className="mt-0.5 ml-auto h-3.5 w-12" />
            </div>
            <div className={cn(LIST_COLUMNS.uploaded, 'h-5')}>
              <Skeleton className="mt-0.5 ml-auto h-3.5 w-20" />
            </div>
            <span className="size-7 shrink-0" />
          </li>
        ))}
      </ul>
    </div>
  );
}
