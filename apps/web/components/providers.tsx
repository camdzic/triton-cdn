'use client';

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider
} from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { type ReactNode, useState } from 'react';
import { ActivityPanel } from '@/components/activity-panel';
import { TooltipProvider } from '@/components/ui/tooltip';
import { APIError, isUnauthorized } from '@/lib/api';
import { queryKeys } from '@/lib/queries';

function shouldRetry(failures: number, error: Error) {
  if (error instanceof APIError && error.status >= 400 && error.status < 500) {
    return false;
  }

  return failures < 2;
}

function createClient() {
  function sessionExpired(error: Error) {
    if (
      isUnauthorized(error) &&
      client.getQueryData(queryKeys.account) !== undefined
    ) {
      void client.invalidateQueries({ queryKey: queryKeys.account });
    }
  }

  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError(error, query) {
        if (query.queryKey[0] !== queryKeys.account[0]) {
          sessionExpired(error);
        }
      }
    }),
    mutationCache: new MutationCache({ onError: sessionExpired }),
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        refetchOnWindowFocus: false
      }
    }
  });

  return client;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(createClient);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={client}>
        <TooltipProvider>
          {children}
          <ActivityPanel />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
