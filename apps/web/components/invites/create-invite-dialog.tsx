'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreatedInvite } from '@triton/shared';
import { CopyIcon, LinkIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { notify } from '@/lib/activity';
import { api, errorMessage } from '@/lib/api';
import { copyText } from '@/lib/browser';
import { formatDate } from '@/lib/format';
import { queryKeys } from '@/lib/queries';

const EXPIRY_OPTIONS = [
  { value: 1, label: '1 day' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' }
];

export function inviteLink(code: string) {
  return `${window.location.origin}/register?${new URLSearchParams({ code })}`;
}

export async function copyInvite(value: string, what: string) {
  if (await copyText(value)) {
    notify.success(`${what} copied`);
  } else {
    notify.error('Clipboard unavailable', value);
  }
}

function Created({ created }: { created: CreatedInvite }) {
  const expires =
    created.invite.status === 'open' ? created.invite.expiresAt : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-muted/60 ring-foreground/10 rounded-xl px-4 py-5 text-center ring-1">
        <p className="text-gradient font-mono text-lg font-semibold tracking-wider break-all sm:text-xl">
          {created.code}
        </p>
        {expires === null ? null : (
          <p className="text-muted-foreground mt-2 text-xs">
            Single use · expires {formatDate(expires)}
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          variant="outline"
          onClick={() => void copyInvite(created.code, 'Invite code')}
        >
          <CopyIcon />
          Copy code
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            void copyInvite(inviteLink(created.code), 'Invite link')
          }
        >
          <LinkIcon />
          Copy signup link
        </Button>
      </div>
    </div>
  );
}

export function CreateInviteDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(7);

  const create = useMutation({
    mutationFn: (expiresInDays: number) => api.createInvite({ expiresInDays }),
    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invites });
    },
    onError(error) {
      notify.error('Could not create the invite', errorMessage(error));
    }
  });

  function change(next: boolean) {
    setOpen(next);

    if (next) {
      create.reset();
      setDays(7);
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger render={<Button />}>
        <PlusIcon />
        New invite
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {create.isSuccess ? 'Invite ready' : 'Create an invite'}
          </DialogTitle>
          <DialogDescription>
            {create.isSuccess
              ? 'Share this code with the person you are inviting. It works once.'
              : 'Anyone with the code can create one account on this server.'}
          </DialogDescription>
        </DialogHeader>
        {create.isSuccess ? (
          <Created created={create.data} />
        ) : (
          <Field>
            <FieldLabel htmlFor="expiry">Expires after</FieldLabel>
            <Select
              items={EXPIRY_OPTIONS}
              value={days}
              onValueChange={(value) => {
                if (typeof value === 'number') {
                  setDays(value);
                }
              }}
            >
              <SelectTrigger id="expiry" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              Unused invites stop working after this.
            </FieldDescription>
          </Field>
        )}
        {create.isSuccess ? null : (
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              disabled={create.isPending}
              onClick={() => create.mutate(days)}
            >
              {create.isPending ? <Spinner /> : null}
              Create invite
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
