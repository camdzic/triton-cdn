'use client';

import { RefreshCwIcon, ServerCrashIcon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { AccountContext } from '@/components/account-context';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty';
import { Separator } from '@/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger
} from '@/components/ui/sidebar';
import { DropOverlay } from '@/components/uploads/drop-overlay';
import { UploadProvider } from '@/components/uploads/upload-context';
import { errorMessage, isUnauthorized } from '@/lib/api';
import { useAccount } from '@/lib/queries';
import { AppSidebar } from './app-sidebar';
import { activeItem } from './navigation';

function Unavailable({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ServerCrashIcon />
          </EmptyMedia>
          <EmptyTitle>Could not load your account</EmptyTitle>
          <EmptyDescription>{errorMessage(error)}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={retry}>
            <RefreshCwIcon />
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}

function Header() {
  const pathname = usePathname();
  const item = activeItem(pathname);

  return (
    <header className="bg-background/80 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur md:rounded-t-xl md:px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mx-1 my-auto h-4" />
      <h1 className="truncate text-sm font-medium">
        {item === undefined ? 'triton' : item.label}
      </h1>
    </header>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const account = useAccount();
  const signedOut = account.isError && isUnauthorized(account.error);

  useEffect(() => {
    if (signedOut) {
      router.replace('/login');
    }
  }, [signedOut, router]);

  if (account.isError && !signedOut && account.data === undefined) {
    return (
      <Unavailable error={account.error} retry={() => account.refetch()} />
    );
  }

  return (
    <AccountContext
      value={account.data === undefined || signedOut ? null : account.data}
    >
      <UploadProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="min-w-0">
            <Header />
            <div className="flex flex-1 flex-col p-4 md:p-6">{children}</div>
          </SidebarInset>
        </SidebarProvider>
        <DropOverlay />
      </UploadProvider>
    </AccountContext>
  );
}
