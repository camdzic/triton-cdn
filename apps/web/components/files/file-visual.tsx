'use client';

import type { FileEntry } from '@triton/shared';
import {
  FileArchiveIcon,
  FileIcon,
  FileTextIcon,
  FileTypeIcon,
  FilmIcon,
  ImageIcon,
  LockIcon,
  type LucideIcon,
  MusicIcon
} from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { extensionOf, type FileKind, fileKind } from '@/lib/format';
import { cn } from '@/lib/utils';

const KIND_ICONS: Record<FileKind, LucideIcon> = {
  image: ImageIcon,
  video: FilmIcon,
  audio: MusicIcon,
  text: FileTextIcon,
  pdf: FileTypeIcon,
  archive: FileArchiveIcon,
  other: FileIcon
};

const KIND_TONES: Record<FileKind, string> = {
  image: 'bg-violet-500/12 text-violet-600 dark:text-violet-300',
  video: 'bg-sky-500/12 text-sky-600 dark:text-sky-300',
  audio: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300',
  text: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
  pdf: 'bg-rose-500/12 text-rose-600 dark:text-rose-300',
  archive: 'bg-orange-500/12 text-orange-600 dark:text-orange-300',
  other: 'bg-muted text-muted-foreground'
};

export function filePath(file: FileEntry) {
  return new URL(file.url).pathname;
}

export function PrivateMark({ className }: { className?: string }) {
  return (
    <LockIcon
      role="img"
      aria-label="Private"
      className={cn('size-3.5 shrink-0', className)}
    />
  );
}

export function FileBadge({
  file,
  className
}: {
  file: FileEntry;
  className?: string;
}) {
  const kind = fileKind(file);
  const Icon = KIND_ICONS[kind];

  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-lg',
        KIND_TONES[kind],
        className
      )}
    >
      <Icon className="size-4.5" />
    </span>
  );
}

function Placeholder({ file }: { file: FileEntry }) {
  const kind = fileKind(file);
  const Icon = KIND_ICONS[kind];
  const extension = extensionOf(file.name);

  return (
    <div
      className={cn(
        'flex size-full flex-col items-center justify-center gap-2',
        KIND_TONES[kind]
      )}
    >
      <Icon className="size-8" strokeWidth={1.5} />
      <span className="font-mono text-[0.7rem] font-medium tracking-wider opacity-80">
        {extension === '' ? 'UNKNOWN' : extension}
      </span>
    </div>
  );
}

export function FileThumbnail({ file }: { file: FileEntry }) {
  const [broken, setBroken] = useState(false);
  const kind = fileKind(file);

  if (broken) {
    return <Placeholder file={file} />;
  }

  if (kind === 'image') {
    return (
      <div className="bg-checker relative size-full">
        <Image
          draggable={false}
          src={filePath(file)}
          alt={file.name}
          fill
          sizes="(min-width: 1280px) 20vw, (min-width: 768px) 30vw, 50vw"
          className="object-cover transition-transform duration-300 group-hover/file:scale-[1.03]"
          onError={() => setBroken(true)}
        />
      </div>
    );
  }

  if (kind === 'video') {
    return (
      <video
        draggable={false}
        src={`${filePath(file)}#t=0.1`}
        preload="metadata"
        muted
        playsInline
        className="size-full bg-black object-cover"
        onError={() => setBroken(true)}
      />
    );
  }

  return <Placeholder file={file} />;
}
