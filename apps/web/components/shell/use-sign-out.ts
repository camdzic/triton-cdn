'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { notify } from '@/lib/activity';
import { api } from '@/lib/api';

export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.logout().catch(() => null),
    onSuccess() {
      queryClient.clear();
      router.replace('/login');
      notify.info('Signed out');
    }
  });
}
