'use client';

import type { FileEntry } from '@triton/shared';
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FilesIcon,
  HardDriveIcon,
  LayoutGridIcon,
  ListIcon,
  RefreshCwIcon,
  UploadCloudIcon,
  UploadIcon
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCurrentAccount } from '@/components/account-context';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty';
import { Kbd } from '@/components/ui/kbd';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useUploads } from '@/components/uploads/upload-context';
import { useStoredState } from '@/hooks/use-stored-state';
import { errorMessage } from '@/lib/api';
import { FILE_VIEW_KEY, FILE_VIEWS, markFileView } from '@/lib/file-view';
import { formatBytes, formatDay, plural } from '@/lib/format';
import { FILES_PAGE_SIZE, useFilePage } from '@/lib/queries';
import { DeleteFileDialog } from './delete-file-dialog';
import type { FileIntent } from './file-actions';
import { FileLinkDialog } from './file-link-dialog';
import { FilePreviewDialog } from './file-preview-dialog';
import {
  FileGrid,
  FileGridSkeleton,
  FileList,
  FileListSkeleton
} from './file-views';

type Selection = { file: FileEntry; intent: FileIntent } | null;

function latest(file: FileEntry | null, files: readonly FileEntry[]) {
  if (file === null) {
    return null;
  }

  const fresh = files.find((entry) => entry.id === file.id);

  return fresh === undefined ? file : fresh;
}

function Stats() {
  const account = useCurrentAccount();

  return (
    <div className="mb-6 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4 lg:grid-cols-3">
      <StatCard
        label="Files"
        value={
          account === null ? null : account.usage.files.toLocaleString('en')
        }
        icon={FilesIcon}
      />
      <StatCard
        label="Storage"
        value={account === null ? null : formatBytes(account.usage.bytes)}
        icon={HardDriveIcon}
      />
      <StatCard
        label="Member since"
        value={account === null ? null : formatDay(account.user.createdAt)}
        icon={CalendarIcon}
        className="min-[360px]:col-span-2 lg:col-span-1"
      />
    </div>
  );
}

function EmptyFiles() {
  const { pick } = useUploads();

  return (
    <Empty className="border-border bg-card/50 border border-dashed">
      <EmptyHeader>
        <EmptyMedia className="bg-gradient-brand flex size-14 items-center justify-center rounded-2xl text-white shadow-lg">
          <UploadCloudIcon className="size-7" />
        </EmptyMedia>
        <EmptyTitle>No uploads yet</EmptyTitle>
        <EmptyDescription>
          Drop files anywhere on this page, or pick them from your device. Every
          file gets its own key and a short public link.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={pick}>
          <UploadIcon />
          Upload files
        </Button>
      </EmptyContent>
    </Empty>
  );
}

function Pager({
  offset,
  shown,
  total,
  onChange
}: {
  offset: number;
  shown: number;
  total: number;
  onChange: (offset: number) => void;
}) {
  if (total <= FILES_PAGE_SIZE) {
    return null;
  }

  const page = Math.floor(offset / FILES_PAGE_SIZE) + 1;
  const pages = Math.ceil(total / FILES_PAGE_SIZE);

  return (
    <nav
      aria-label="Pagination"
      className="mt-6 flex items-center justify-between gap-3"
    >
      <p className="text-muted-foreground text-sm tabular-nums">
        {offset + 1}–{offset + shown} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - FILES_PAGE_SIZE))}
        >
          <ChevronLeftIcon />
          <span className="hidden sm:inline">Previous</span>
        </Button>
        <span className="text-muted-foreground text-sm tabular-nums">
          {page} / {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={offset + FILES_PAGE_SIZE >= total}
          onClick={() => onChange(offset + FILES_PAGE_SIZE)}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRightIcon />
        </Button>
      </div>
    </nav>
  );
}

export function FilesPage() {
  const [offset, setOffset] = useState(0);
  const [view, setView] = useStoredState(FILE_VIEW_KEY, FILE_VIEWS, 'grid');

  useEffect(() => {
    markFileView(view);
  }, [view]);
  const [selection, setSelection] = useState<Selection>(null);
  const [lastFile, setLastFile] = useState<FileEntry | null>(null);
  const page = useFilePage(offset);

  function intend(file: FileEntry, intent: FileIntent) {
    setLastFile(file);
    setSelection({ file, intent });
  }

  function close() {
    setSelection(null);
  }

  const data = page.data;
  const target = latest(lastFile, data === undefined ? [] : data.files);

  if (data !== undefined && data.files.length === 0 && offset > 0) {
    setOffset(Math.max(0, offset - FILES_PAGE_SIZE));
  }

  return (
    <>
      <PageHeader
        title="Files"
        description={
          <>
            Everything you have uploaded. Drop files anywhere to upload
            <span className="hidden md:inline">
              , or press <Kbd>Ctrl</Kbd> <Kbd>B</Kbd> to toggle the sidebar
            </span>
            .
          </>
        }
        actions={
          <ToggleGroup
            variant="outline"
            value={[view]}
            onValueChange={(value) => {
              const [next] = value;

              if (next === 'grid' || next === 'list') {
                setView(next);
              }
            }}
            aria-label="Layout"
          >
            <ToggleGroupItem
              value="grid"
              aria-label="Grid view"
              className="tiles-view:bg-muted! list-view:not-hover:bg-transparent!"
            >
              <LayoutGridIcon />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="list"
              aria-label="List view"
              className="list-view:bg-muted! tiles-view:not-hover:bg-transparent!"
            >
              <ListIcon />
            </ToggleGroupItem>
          </ToggleGroup>
        }
      />
      <Stats />
      {page.isPending ? (
        <>
          <div className="mb-3 flex h-5 items-center">
            <Skeleton className="h-3.5 w-16" />
          </div>
          <FileGridSkeleton className="list-view:hidden" />
          <FileListSkeleton className="hidden list-view:block" />
        </>
      ) : page.isError ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>Could not load your files</EmptyTitle>
            <EmptyDescription>{errorMessage(page.error)}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => page.refetch()}>
              <RefreshCwIcon />
              Try again
            </Button>
          </EmptyContent>
        </Empty>
      ) : page.data.total === 0 ? (
        <EmptyFiles />
      ) : (
        <>
          <div className="text-muted-foreground mb-3 flex items-center justify-between text-sm">
            <span>{plural(page.data.total, 'file')}</span>
            {page.isFetching ? <span>Refreshing…</span> : null}
          </div>
          {view === 'grid' ? (
            <FileGrid files={page.data.files} onIntent={intend} />
          ) : (
            <FileList files={page.data.files} onIntent={intend} />
          )}
          <Pager
            offset={offset}
            shown={page.data.files.length}
            total={page.data.total}
            onChange={(next) => {
              setOffset(next);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </>
      )}
      <FilePreviewDialog
        file={target}
        open={selection !== null && selection.intent === 'preview'}
        onOpenChange={(open) => {
          if (!open) {
            close();
          }
        }}
        onIntent={intend}
      />
      <FileLinkDialog
        file={target}
        open={selection !== null && selection.intent === 'link'}
        onOpenChange={(open) => {
          if (!open) {
            close();
          }
        }}
        onDone={close}
      />
      <DeleteFileDialog
        file={target}
        open={selection !== null && selection.intent === 'delete'}
        onOpenChange={(open) => {
          if (!open) {
            close();
          }
        }}
        onDeleted={close}
      />
    </>
  );
}
