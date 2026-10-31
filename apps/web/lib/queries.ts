'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FilePage, UpdateFileInput } from '@triton/shared';
import { api } from './api';

export const FILES_PAGE_SIZE = 24;

export const queryKeys = {
  account: ['account'],
  files: ['files'],
  filePage: (offset: number) => ['files', offset],
  invites: ['invites']
} as const;

export function useAccount() {
  return useQuery({
    queryKey: queryKeys.account,
    queryFn: api.account,
    staleTime: 30_000
  });
}

export function useFilePage(offset: number) {
  return useQuery({
    queryKey: queryKeys.filePage(offset),
    queryFn: () => api.files(FILES_PAGE_SIZE, offset),
    placeholderData: (previous) => previous
  });
}

export function useUpdateFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateFileInput }) =>
      api.updateFile(id, input),
    onSuccess(updated) {
      queryClient.setQueriesData<FilePage>(
        { queryKey: queryKeys.files },
        (page) =>
          page === undefined
            ? page
            : {
                ...page,
                files: page.files.map((file) =>
                  file.id === updated.id ? updated : file
                )
              }
      );
    }
  });
}

export function useInvites(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.invites,
    queryFn: api.invites,
    enabled
  });
}
