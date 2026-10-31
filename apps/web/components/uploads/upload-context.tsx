'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, use, useEffect, useRef } from 'react';
import {
  dismissActivity,
  setUploadCanceller,
  trackUploads,
  updateUpload
} from '@/lib/activity';
import { api, errorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/queries';

interface UploadContextValue {
  upload: (files: readonly File[]) => void;
  pick: () => void;
}

const UploadContext = createContext<UploadContextValue | null>(null);

const CONCURRENCY = 3;

export function useUploads() {
  const value = use(UploadContext);

  if (value === null) {
    throw new Error('useUploads must be used inside UploadProvider');
  }

  return value;
}

interface Pending {
  id: string;
  file: File;
}

export function UploadProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const queue = useRef<Pending[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const active = useRef(0);

  useEffect(() => {
    setUploadCanceller((id) => {
      const controller = controllers.current.get(id);

      if (controller) {
        controller.abort();
        return;
      }

      queue.current = queue.current.filter((pending) => pending.id !== id);
      dismissActivity(id);
    });

    return () => setUploadCanceller(null);
  }, []);

  async function run(next: Pending) {
    const controller = new AbortController();

    controllers.current.set(next.id, controller);
    updateUpload(next.id, (item) => ({
      ...item,
      sent: 0,
      status: 'uploading'
    }));

    try {
      const file = await api.upload(
        next.file,
        (sent) => updateUpload(next.id, (item) => ({ ...item, sent })),
        controller.signal
      );

      updateUpload(next.id, (item) => ({
        kind: 'upload',
        id: item.id,
        createdAt: item.createdAt,
        name: item.name,
        size: item.size,
        sent: item.size,
        status: 'done',
        url: file.url
      }));

      void queryClient.invalidateQueries({ queryKey: queryKeys.files });
      void queryClient.invalidateQueries({ queryKey: queryKeys.account });
    } catch (error) {
      updateUpload(next.id, (item) => ({
        kind: 'upload',
        id: item.id,
        createdAt: item.createdAt,
        name: item.name,
        size: item.size,
        sent: item.sent,
        status: 'failed',
        error: errorMessage(error)
      }));
    } finally {
      controllers.current.delete(next.id);
    }
  }

  function pump() {
    while (active.current < CONCURRENCY) {
      const next = queue.current.shift();

      if (next === undefined) {
        return;
      }

      active.current += 1;

      void run(next).finally(() => {
        active.current -= 1;
        pump();
      });
    }
  }

  function upload(files: readonly File[]) {
    if (files.length === 0) {
      return;
    }

    const added = files.map((file) => ({
      id: crypto.randomUUID(),
      file
    }));

    trackUploads(
      added.map(({ id, file }) => ({ id, name: file.name, size: file.size }))
    );

    queue.current.push(...added);
    pump();
  }

  function pick() {
    if (input.current) {
      input.current.click();
    }
  }

  return (
    <UploadContext value={{ upload, pick }}>
      {children}
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          const { files } = event.currentTarget;

          upload(files === null ? [] : Array.from(files));
          event.currentTarget.value = '';
        }}
      />
    </UploadContext>
  );
}
