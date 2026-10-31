'use client';

import type { Account } from '@triton/shared';
import {
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  TerminalIcon
} from 'lucide-react';
import { useTheme } from 'next-themes';
import type { ReactNode } from 'react';
import { useCurrentAccount } from '@/components/account-context';
import { CopyCommand } from '@/components/copy-command';
import { PageHeader } from '@/components/page-header';
import { useSignOut } from '@/components/shell/use-sign-out';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useHydrated } from '@/hooks/use-hydrated';
import { formatBytes, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const THEMES = [
  { value: 'system', label: 'System', icon: MonitorIcon },
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon }
] as const;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="min-w-0 text-sm font-medium break-all sm:text-right">
        {children}
      </dd>
    </div>
  );
}

function Appearance() {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const saved = theme === undefined ? 'system' : theme;
  const current = hydrated ? saved : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Saved in this browser.</CardDescription>
      </CardHeader>
      <CardContent>
        <fieldset className="grid grid-cols-3 gap-2 sm:gap-3">
          <legend className="sr-only">Theme</legend>
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={current === value}
              onClick={() => setTheme(value)}
              className={cn(
                'ring-foreground/10 hover:bg-muted/60 flex flex-col items-center gap-2 rounded-xl px-2 py-4 text-sm font-medium ring-1 transition-colors',
                current === value &&
                  'ring-primary bg-primary/5 text-primary hover:bg-primary/10 ring-2'
              )}
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
        </fieldset>
      </CardContent>
    </Card>
  );
}

const PROFILE_LABELS = [
  'Username',
  'Role',
  'Member since',
  'Uploads',
  'User ID'
] as const;

function ProfileSkeleton() {
  return PROFILE_LABELS.map((label) => (
    <Row key={label} label={label}>
      <Skeleton className="h-5 w-28 sm:ml-auto" />
    </Row>
  ));
}

function ProfileRows({ account }: { account: Account }) {
  const { user, usage } = account;

  return (
    <>
      <Row label="Username">{user.username}</Row>
      <Row label="Role">
        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
          {user.role === 'admin' ? 'Admin' : 'Member'}
        </Badge>
      </Row>
      <Row label="Member since">{formatDate(user.createdAt)}</Row>
      <Row label="Uploads">
        {usage.files.toLocaleString('en')} · {formatBytes(usage.bytes)}
      </Row>
      <Row label="User ID">
        <span className="font-mono text-xs">{user.id}</span>
      </Row>
    </>
  );
}

export function AccountPage() {
  const account = useCurrentAccount();
  const signOut = useSignOut();
  const hydrated = useHydrated();
  const origin = hydrated ? window.location.origin : '';

  return (
    <>
      <PageHeader
        title="Account"
        description="Your profile, preferences and session."
      />
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              {account === null ? (
                <ProfileSkeleton />
              ) : (
                <ProfileRows account={account} />
              )}
            </dl>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4 lg:gap-6">
          <Appearance />
          <Card>
            <CardHeader>
              <CardTitle>Session</CardTitle>
              <CardDescription>
                Signs out this browser only. Your CLI sessions stay signed in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                disabled={signOut.isPending}
                onClick={() => signOut.mutate()}
              >
                {signOut.isPending ? <Spinner /> : <LogOutIcon />}
                Sign out
              </Button>
            </CardContent>
          </Card>
        </div>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TerminalIcon className="size-4" />
              Use triton from the terminal
            </CardTitle>
            <CardDescription>
              Install the CLI, point it at this server and sign in with the same
              account.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 lg:grid-cols-2">
            <CopyCommand command="bun install -g @aaldiin/triton" />
            <CopyCommand command={`triton server ${origin}`} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
