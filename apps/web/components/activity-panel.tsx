'use client';

import {
  BellIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  CopyIcon,
  FileUpIcon,
  InfoIcon,
  type LucideIcon,
  XIcon
} from 'lucide-react';
import { type ReactNode, useState, useSyncExternalStore } from 'react';
import { DismissTimer } from '@/components/dismiss-timer';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  type ActivityItem,
  cancelUpload,
  clearActivity,
  currentActivity,
  dismissActivity,
  isRunning,
  type NoticeItem,
  type NoticeTone,
  notify,
  subscribeActivity,
  type UploadItem
} from '@/lib/activity';
import { copyText } from '@/lib/browser';
import { formatBytes, plural } from '@/lib/format';
import { cn } from '@/lib/utils';

const TONES: Record<NoticeTone, { icon: LucideIcon; className: string }> = {
  success: { icon: CheckIcon, className: 'bg-success/15 text-success' },
  error: {
    icon: CircleAlertIcon,
    className: 'bg-destructive/15 text-destructive'
  },
  info: { icon: InfoIcon, className: 'bg-primary/15 text-primary' }
};

function percent(item: UploadItem) {
  return item.size === 0 ? 100 : Math.round((item.sent / item.size) * 100);
}

function Badge({
  icon: Icon,
  className
}: {
  icon: LucideIcon;
  className: string;
}) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-md',
        className
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

function Row({
  badge,
  title,
  detail,
  action,
  progress,
  timer
}: {
  badge: ReactNode;
  title: string;
  detail?: ReactNode;
  action: ReactNode;
  progress?: number;
  timer: ReactNode;
}) {
  return (
    <li className="animate-in fade-in slide-in-from-bottom-1 relative flex items-center gap-3 px-3 py-2.5">
      {badge}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        {detail === undefined ? null : (
          <p className="truncate text-xs">{detail}</p>
        )}
        {progress === undefined ? null : (
          <Progress value={progress} className="mt-1.5" />
        )}
      </div>
      {action}
      {timer}
    </li>
  );
}

function IconButton({
  label,
  icon: Icon,
  onClick
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick}>
      <Icon />
    </Button>
  );
}

function Timer({ item, paused }: { item: ActivityItem; paused: boolean }) {
  if (isRunning(item)) {
    return null;
  }

  return (
    <DismissTimer
      paused={paused}
      onElapsed={() => dismissActivity(item.id)}
      className="absolute inset-x-0 bottom-0"
    />
  );
}

function NoticeRow({ item, paused }: { item: NoticeItem; paused: boolean }) {
  const tone = TONES[item.tone];

  return (
    <Row
      badge={<Badge icon={tone.icon} className={tone.className} />}
      title={item.title}
      detail={
        item.description === undefined ? undefined : (
          <span className="text-muted-foreground">{item.description}</span>
        )
      }
      action={
        <IconButton
          label="Dismiss"
          icon={XIcon}
          onClick={() => dismissActivity(item.id)}
        />
      }
      timer={<Timer item={item} paused={paused} />}
    />
  );
}

function uploadDetail(item: UploadItem) {
  switch (item.status) {
    case 'queued':
      return <span className="text-muted-foreground">Waiting…</span>;
    case 'uploading':
      return (
        <span className="text-muted-foreground tabular-nums">
          {formatBytes(item.sent)} of {formatBytes(item.size)} · {percent(item)}
          %
        </span>
      );
    case 'done':
      return (
        <span className="text-success">
          {formatBytes(item.size)} · encrypted
        </span>
      );
    case 'failed':
      return <span className="text-destructive">{item.error}</span>;
  }
}

function uploadAction(item: UploadItem) {
  switch (item.status) {
    case 'done': {
      const { url } = item;

      return (
        <IconButton
          label={`Copy link for ${item.name}`}
          icon={CopyIcon}
          onClick={() => {
            void copyText(url).then((copied) => {
              if (copied) {
                notify.success('Link copied', url);
              } else {
                notify.error('Clipboard unavailable', url);
              }
            });
          }}
        />
      );
    }
    case 'failed':
      return (
        <IconButton
          label="Dismiss"
          icon={XIcon}
          onClick={() => dismissActivity(item.id)}
        />
      );
    default:
      return (
        <IconButton
          label={`Cancel ${item.name}`}
          icon={XIcon}
          onClick={() => cancelUpload(item.id)}
        />
      );
  }
}

function uploadBadge(item: UploadItem) {
  switch (item.status) {
    case 'done':
      return <Badge icon={CheckIcon} className={TONES.success.className} />;
    case 'failed':
      return <Badge icon={CircleAlertIcon} className={TONES.error.className} />;
    default:
      return (
        <Badge icon={FileUpIcon} className="bg-muted text-muted-foreground" />
      );
  }
}

function UploadRow({ item, paused }: { item: UploadItem; paused: boolean }) {
  return (
    <Row
      badge={uploadBadge(item)}
      title={item.name}
      detail={uploadDetail(item)}
      action={uploadAction(item)}
      progress={item.status === 'uploading' ? percent(item) : undefined}
      timer={<Timer item={item} paused={paused} />}
    />
  );
}

function headline(items: readonly ActivityItem[]) {
  const running = items.filter(isRunning).length;

  if (running > 0) {
    return `Uploading ${plural(running, 'file')}`;
  }

  const uploads = items.filter((item) => item.kind === 'upload');

  if (uploads.length === items.length) {
    const failed = uploads.filter(
      (item) => item.kind === 'upload' && item.status === 'failed'
    ).length;

    return failed > 0
      ? `${plural(uploads.length - failed, 'upload')} done, ${failed} failed`
      : `${plural(uploads.length, 'upload')} complete`;
  }

  return 'Notifications';
}

export function ActivityPanel() {
  const items = useSyncExternalStore(
    subscribeActivity,
    currentActivity,
    currentActivity
  );
  const [collapsed, setCollapsed] = useState(false);
  const [held, setHeld] = useState(false);

  if (items.length === 0) {
    if (collapsed || held) {
      setCollapsed(false);
      setHeld(false);
    }

    return null;
  }

  const running = items.filter(isRunning).length;
  const newestFirst = items.toReversed();

  return (
    <section
      aria-label="Notifications"
      aria-live="polite"
      className="bg-popover text-popover-foreground ring-foreground/10 animate-in fade-in slide-in-from-bottom-4 fixed inset-x-3 bottom-3 z-50 overflow-hidden rounded-xl shadow-2xl ring-1 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-96"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setHeld(false);
        }
      }}
    >
      <header className="flex items-center gap-2 border-b py-2 pr-2 pl-3">
        <span className="text-muted-foreground flex size-6 items-center justify-center">
          <BellIcon className="size-4" />
        </span>
        <p className="flex-1 truncate text-sm font-medium">{headline(items)}</p>
        {items.length > 1 ? (
          <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
            {items.length}
          </span>
        ) : null}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={
            collapsed ? 'Expand notifications' : 'Collapse notifications'
          }
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
        >
          <ChevronDownIcon
            className={cn('transition-transform', collapsed && 'rotate-180')}
          />
        </Button>
        {running === 0 ? (
          <IconButton
            label="Dismiss all"
            icon={XIcon}
            onClick={() => {
              setHeld(false);
              clearActivity();
            }}
          />
        ) : null}
      </header>
      {
        <ul hidden={collapsed} className="max-h-80 divide-y overflow-y-auto">
          {newestFirst.map((item) =>
            item.kind === 'notice' ? (
              <NoticeRow key={item.id} item={item} paused={held} />
            ) : (
              <UploadRow key={item.id} item={item} paused={held} />
            )
          )}
        </ul>
      }
    </section>
  );
}
