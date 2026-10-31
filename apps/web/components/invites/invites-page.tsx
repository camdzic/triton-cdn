'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Invite } from '@triton/shared';
import {
  CopyIcon,
  LinkIcon,
  RefreshCwIcon,
  ShieldIcon,
  TicketCheckIcon,
  TicketIcon,
  TicketXIcon,
  Trash2Icon,
  UserXIcon
} from 'lucide-react';
import { useState } from 'react';
import { useCurrentAccount } from '@/components/account-context';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import { RelativeTime } from '@/components/relative-time';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { notify } from '@/lib/activity';
import { api, errorMessage } from '@/lib/api';
import { formatBytes, plural } from '@/lib/format';
import { queryKeys, useInvites } from '@/lib/queries';
import { cn } from '@/lib/utils';
import {
  CreateInviteDialog,
  copyInvite,
  inviteLink
} from './create-invite-dialog';

type Filter = 'all' | Invite['status'];

type Pending =
  | { kind: 'revoke'; invite: Invite }
  | { kind: 'remove'; invite: Extract<Invite, { status: 'used' }> }
  | null;

const STATUS_STYLES: Record<Invite['status'], string> = {
  open: 'bg-warning/15 text-warning',
  used: 'bg-success/15 text-success',
  expired: 'bg-muted text-muted-foreground'
};

const STATUS_ORDER: Record<Invite['status'], number> = {
  used: 0,
  open: 1,
  expired: 2
};

const STATUS_LABELS: Record<Invite['status'], string> = {
  open: 'Open',
  used: 'Used',
  expired: 'Expired'
};

function StatusBadge({ status }: { status: Invite['status'] }) {
  return (
    <Badge className={cn('border-transparent', STATUS_STYLES[status])}>
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function When({ prefix, iso }: { prefix: string; iso: string }) {
  return <RelativeTime iso={iso} prefix={prefix} />;
}

function InviteRow({
  invite,
  onAction
}: {
  invite: Invite;
  onAction: (pending: Pending) => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 p-4">
      <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={invite.status} />
          {invite.status === 'open' ? (
            <code className="font-mono text-sm font-medium tracking-wide whitespace-nowrap">
              {invite.code}
            </code>
          ) : null}
          {invite.status === 'used' ? (
            <span className="truncate text-sm font-medium">
              {invite.account.username}
            </span>
          ) : null}
        </div>
        <p className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
          {invite.status === 'open' ? (
            <When prefix="Expires" iso={invite.expiresAt} />
          ) : null}
          {invite.status === 'used' ? (
            <>
              <When prefix="Joined" iso={invite.usedAt} />
              <span>{plural(invite.account.files, 'file')}</span>
              <span>{formatBytes(invite.account.bytes)}</span>
            </>
          ) : null}
          {invite.status === 'expired' ? (
            <When prefix="Expired" iso={invite.expiresAt} />
          ) : null}
          <When prefix="Created" iso={invite.createdAt} />
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {invite.status === 'open' ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void copyInvite(invite.code, 'Invite code')}
            >
              <CopyIcon />
              Code
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void copyInvite(inviteLink(invite.code), 'Invite link')
              }
            >
              <LinkIcon />
              Link
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onAction({ kind: 'revoke', invite })}
            >
              <TicketXIcon />
              Revoke
            </Button>
          </>
        ) : null}
        {invite.status === 'used' ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onAction({ kind: 'remove', invite })}
          >
            <UserXIcon />
            Revoke
          </Button>
        ) : null}
        {invite.status === 'expired' ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAction({ kind: 'revoke', invite })}
          >
            <Trash2Icon />
            Delete
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function confirmCopy(pending: NonNullable<Pending>) {
  if (pending.kind === 'remove') {
    const { username, files, bytes } = pending.invite.account;

    return {
      icon: UserXIcon,
      title: `Revoke access for ${username}?`,
      description: `This permanently deletes the account, its sessions and its ${plural(files, 'file')} (${formatBytes(bytes)}). Links to those files stop working.`,
      action: 'Revoke'
    };
  }

  if (pending.invite.status === 'open') {
    return {
      icon: TicketXIcon,
      title: 'Revoke this invite?',
      description: 'The code will stop working immediately.',
      action: 'Revoke'
    };
  }

  return {
    icon: Trash2Icon,
    title: 'Delete this invite?',
    description: 'It will be removed from the list.',
    action: 'Delete'
  };
}

function ListSkeleton() {
  return (
    <div className="bg-card ring-foreground/10 divide-y rounded-xl ring-1">
      {['a', 'b', 'c'].map((key) => (
        <div key={key} className="flex flex-col gap-2 p-4">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </div>
  );
}

function AdminOnly() {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldIcon />
        </EmptyMedia>
        <EmptyTitle>Admins only</EmptyTitle>
        <EmptyDescription>
          Only the server admin can create and manage invites.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function InvitesPage() {
  const account = useCurrentAccount();
  const loading = account === null;
  const admin = account !== null && account.user.role === 'admin';
  const queryClient = useQueryClient();
  const invites = useInvites(admin);
  const [filter, setFilter] = useState<Filter>('all');
  const [pending, setPending] = useState<Pending>(null);
  const [last, setLast] = useState<NonNullable<Pending> | null>(null);

  const act = useMutation({
    mutationFn: (target: NonNullable<Pending>) =>
      target.kind === 'remove'
        ? api.removeInviteAccount(target.invite.id)
        : api.revokeInvite(target.invite.id),
    async onSuccess(_, target) {
      setPending(null);
      if (target.kind === 'remove') {
        notify.success('Access revoked', target.invite.account.username);
      } else {
        notify.success(
          target.invite.status === 'open' ? 'Invite revoked' : 'Invite deleted'
        );
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.invites });
    },
    onError(error) {
      notify.error('Could not revoke', errorMessage(error));
    }
  });

  if (!loading && !admin) {
    return (
      <>
        <PageHeader
          title="Invites"
          description="Invite people to this server."
        />
        <AdminOnly />
      </>
    );
  }

  const list = invites.data === undefined ? [] : invites.data;
  const counts = { open: 0, used: 0, expired: 0 };

  for (const invite of list) {
    counts[invite.status] += 1;
  }

  const visible =
    filter === 'all'
      ? list.toSorted(
          (left, right) =>
            STATUS_ORDER[left.status] - STATUS_ORDER[right.status]
        )
      : list.filter((invite) => invite.status === filter);

  const copy = last === null ? null : confirmCopy(last);

  return (
    <>
      <PageHeader
        title="Invites"
        description="Registration is invite-only. Each code creates exactly one account."
        actions={<CreateInviteDialog />}
      />
      <div className="mb-6 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3 sm:gap-4">
        <StatCard
          label="Open"
          value={invites.isSuccess ? counts.open : null}
          icon={TicketIcon}
        />
        <StatCard
          label="Used"
          value={invites.isSuccess ? counts.used : null}
          icon={TicketCheckIcon}
        />
        <StatCard
          label="Expired"
          value={invites.isSuccess ? counts.expired : null}
          icon={TicketXIcon}
          className="min-[360px]:col-span-2 sm:col-span-1"
        />
      </div>
      <Tabs
        value={filter}
        onValueChange={(value) => {
          if (
            value === 'all' ||
            value === 'open' ||
            value === 'used' ||
            value === 'expired'
          ) {
            setFilter(value);
          }
        }}
        className="mb-4"
      >
        <TabsList className="w-full group-data-horizontal/tabs:h-10 sm:w-fit pointer-fine:lg:group-data-horizontal/tabs:h-8">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="used">Used</TabsTrigger>
          <TabsTrigger value="expired">Expired</TabsTrigger>
        </TabsList>
      </Tabs>
      {loading || invites.isPending ? (
        <ListSkeleton />
      ) : invites.isError ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>Could not load invites</EmptyTitle>
            <EmptyDescription>{errorMessage(invites.error)}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => invites.refetch()}>
              <RefreshCwIcon />
              Try again
            </Button>
          </EmptyContent>
        </Empty>
      ) : visible.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TicketIcon />
            </EmptyMedia>
            <EmptyTitle>
              {filter === 'all' ? 'No invites yet' : `No ${filter} invites`}
            </EmptyTitle>
            <EmptyDescription>
              Create an invite to let someone register on this server.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="bg-card ring-foreground/10 divide-y overflow-hidden rounded-xl ring-1">
          {visible.map((invite) => (
            <InviteRow
              key={invite.id}
              invite={invite}
              onAction={(next) => {
                if (next !== null) {
                  setLast(next);
                }

                setPending(next);
              }}
            />
          ))}
        </ul>
      )}
      {copy === null || last === null ? null : (
        <ConfirmDialog
          open={pending !== null}
          onOpenChange={(open) => {
            if (!open) {
              setPending(null);
            }
          }}
          icon={copy.icon}
          title={copy.title}
          description={copy.description}
          action={copy.action}
          pending={act.isPending}
          onConfirm={() => act.mutate(last)}
        />
      )}
    </>
  );
}
