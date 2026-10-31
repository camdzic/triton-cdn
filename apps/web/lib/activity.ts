export type NoticeTone = 'success' | 'error' | 'info';

interface Base {
  id: string;
  createdAt: number;
}

export type NoticeItem = Base & {
  kind: 'notice';
  tone: NoticeTone;
  title: string;
  description?: string;
};

interface UploadBase extends Base {
  kind: 'upload';
  name: string;
  size: number;
  sent: number;
}

export type UploadItem =
  | (UploadBase & { status: 'queued' | 'uploading' })
  | (UploadBase & { status: 'done'; url: string })
  | (UploadBase & { status: 'failed'; error: string });

export type ActivityItem = NoticeItem | UploadItem;

const MAX_NOTICES = 5;

let items: readonly ActivityItem[] = [];
let canceller: ((id: string) => void) | null = null;
const listeners = new Set<() => void>();

function commit(next: readonly ActivityItem[]) {
  items = next;

  for (const listener of listeners) {
    listener();
  }
}

export function isRunning(item: ActivityItem) {
  return (
    item.kind === 'upload' &&
    (item.status === 'queued' || item.status === 'uploading')
  );
}

export function subscribeActivity(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function currentActivity() {
  return items;
}

function pushNotice(tone: NoticeTone, title: string, description?: string) {
  const notice: NoticeItem = {
    kind: 'notice',
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    tone,
    title,
    description
  };

  const notices = [...items.filter((item) => item.kind === 'notice'), notice];
  const kept = new Set(notices.slice(-MAX_NOTICES).map((item) => item.id));

  commit(
    [...items, notice].filter(
      (item) => item.kind !== 'notice' || kept.has(item.id)
    )
  );
}

export const notify = {
  success(title: string, description?: string) {
    pushNotice('success', title, description);
  },
  error(title: string, description?: string) {
    pushNotice('error', title, description);
  },
  info(title: string, description?: string) {
    pushNotice('info', title, description);
  }
};

export function trackUploads(
  added: ReadonlyArray<{ id: string; name: string; size: number }>
) {
  const now = Date.now();

  commit([
    ...items,
    ...added.map(
      ({ id, name, size }): UploadItem => ({
        kind: 'upload',
        id,
        createdAt: now,
        name,
        size,
        sent: 0,
        status: 'queued'
      })
    )
  ]);
}

export function updateUpload(
  id: string,
  change: (item: UploadItem) => UploadItem
) {
  commit(
    items.map((item) =>
      item.kind === 'upload' && item.id === id ? change(item) : item
    )
  );
}

export function dismissActivity(id: string) {
  commit(items.filter((item) => item.id !== id));
}

export function clearActivity() {
  commit(items.filter(isRunning));
}

export function setUploadCanceller(next: ((id: string) => void) | null) {
  canceller = next;
}

export function cancelUpload(id: string) {
  if (canceller !== null) {
    canceller(id);
  }
}
