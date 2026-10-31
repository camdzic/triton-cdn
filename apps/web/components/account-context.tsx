'use client';

import type { Account } from '@triton/shared';
import { createContext, use } from 'react';

export const AccountContext = createContext<Account | null>(null);

export function useCurrentAccount() {
  return use(AccountContext);
}
