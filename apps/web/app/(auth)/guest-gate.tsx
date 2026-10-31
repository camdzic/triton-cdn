'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { useAccount } from '@/lib/queries';

export function GuestGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const account = useAccount();
  const signedIn = account.isSuccess;

  useEffect(() => {
    if (signedIn) {
      router.replace('/');
    }
  }, [signedIn, router]);

  return children;
}
