import { confirm, log, note, type SelectOptions, select } from '@clack/prompts';
import type { Invite } from '@triton/shared';
import { fields, formatBytes, formatDate, formatRelative } from '../lib/format';
import { ask, task } from '../lib/prompt';
import { freshScreen, persist } from '../lib/screen';
import type { Session } from '../lib/session';
import { copyToClipboard } from '../lib/system';
import { brand, dim, green, red, yellow } from '../lib/theme';

type ListChoice =
  | { kind: 'create' }
  | { kind: 'invite'; invite: Invite }
  | { kind: 'back' };

type InviteAction = 'copy' | 'revoke' | 'remove' | 'back';

type UsedInvite = Extract<Invite, { status: 'used' }>;

const BACK = { value: 'back', label: dim('Back') } as const;

function when(iso: string) {
  return `${formatDate(iso)} ${dim(`· ${formatRelative(iso)}`)}`;
}

function usedLabel(invite: UsedInvite) {
  return `${green('●')}  ${invite.account.email}  ${dim(`joined ${formatRelative(invite.usedAt)}`)}`;
}

function inviteLabel(invite: Invite) {
  switch (invite.status) {
    case 'open':
      return `${yellow('●')}  ${invite.code}  ${dim(`expires ${formatRelative(invite.expiresAt)}`)}`;
    case 'used':
      return usedLabel(invite);
    case 'expired':
      return `${red('●')}  ${dim(`expired ${formatRelative(invite.expiresAt)}`)}`;
  }
}

function usedDetails(invite: UsedInvite) {
  const { account } = invite;

  return fields([
    ['Status', green('Used')],
    ['Account', account.email],
    ['Joined', when(invite.usedAt)],
    ['Files', String(account.files)],
    ['Storage', formatBytes(account.bytes)],
    ['Invited', when(invite.createdAt)]
  ]);
}

function inviteDetails(invite: Invite) {
  switch (invite.status) {
    case 'open':
      return fields([
        ['Status', yellow('Open')],
        ['Code', brand(invite.code)],
        ['Created', when(invite.createdAt)],
        ['Expires', when(invite.expiresAt)]
      ]);
    case 'used':
      return usedDetails(invite);
    case 'expired':
      return fields([
        ['Status', red('Expired')],
        ['Created', when(invite.createdAt)],
        ['Expired', when(invite.expiresAt)]
      ]);
  }
}

function inviteActions(invite: Invite): SelectOptions<InviteAction>['options'] {
  switch (invite.status) {
    case 'open':
      return [
        { value: 'copy', label: 'Copy code' },
        { value: 'revoke', label: red('Revoke') },
        BACK
      ];
    case 'used':
      return [{ value: 'remove', label: red('Revoke access') }, BACK];
    case 'expired':
      return [{ value: 'revoke', label: red('Delete') }, BACK];
  }
}

async function copyCode(code: string) {
  if (await copyToClipboard(code)) {
    persist(() => log.success('Invite code copied to clipboard'));
  } else {
    persist(() => log.warn(`Clipboard unavailable · ${brand(code)}`));
  }
}

async function createFlow(session: Session) {
  freshScreen();

  const expiresInDays = ask(
    await select<number>({
      message: 'Invite expires in',
      initialValue: 7,
      options: [
        { value: 1, label: '1 day' },
        { value: 7, label: '7 days' },
        { value: 30, label: '30 days' },
        { value: 90, label: '90 days' }
      ]
    })
  );

  const created = await task(
    'Creating invite',
    () => session.api.createInvite({ expiresInDays }),
    () => 'Invite created'
  );

  const message = `${brand(created.code)}\n\n${dim('Single use. Share it with the person you are inviting.')}`;

  persist(() => note(message, 'Invite code'));

  await copyCode(created.code);
}

async function removeAccount(session: Session, invite: Invite) {
  if (invite.status !== 'used') {
    return false;
  }

  const { email, files, bytes } = invite.account;

  const count = files === 1 ? '1 file' : `${files} files`;
  const sure = ask(
    await confirm({
      message: `Revoke access for ${email}? This permanently deletes the account and its ${count} (${formatBytes(bytes)}).`,
      initialValue: false
    })
  );

  if (!sure) {
    return false;
  }

  await task(
    `Removing ${email}`,
    () => session.api.removeInviteAccount(invite.id),
    () => `Access revoked for ${email}`
  );

  return true;
}

async function inviteScreen(session: Session, invite: Invite) {
  while (true) {
    freshScreen();
    note(inviteDetails(invite), 'Invite');

    const action = ask(
      await select<InviteAction>({
        message: 'What next?',
        options: inviteActions(invite)
      })
    );

    switch (action) {
      case 'copy':
        if (invite.status === 'open') {
          await copyCode(invite.code);
        }

        break;
      case 'revoke': {
        const open = invite.status === 'open';

        const sure = ask(
          await confirm({
            message: open
              ? 'Revoke this invite? The code will stop working.'
              : 'Delete this invite?',
            initialValue: false
          })
        );

        if (sure) {
          await task(
            open ? 'Revoking invite' : 'Deleting invite',
            () => session.api.revokeInvite(invite.id),
            () => (open ? 'Invite revoked' : 'Invite deleted')
          );

          return;
        }

        break;
      }
      case 'remove':
        if (await removeAccount(session, invite)) {
          return;
        }

        break;
      case 'back':
        return;
    }
  }
}

function summary(invites: readonly Invite[]) {
  const counts = { open: 0, used: 0, expired: 0 };

  for (const invite of invites) {
    counts[invite.status] += 1;
  }

  return dim(
    `${counts.open} open · ${counts.used} used · ${counts.expired} expired`
  );
}

export async function invitesFlow(session: Session) {
  while (true) {
    freshScreen();

    const invites = await task('Loading invites', () => session.api.invites());

    const choice = ask(
      await select<ListChoice>({
        message: `Invites ${summary(invites)}`,
        maxItems: 15,
        options: [
          { value: { kind: 'create' }, label: 'New invite' },
          ...invites.map((invite) => ({
            value: { kind: 'invite' as const, invite },
            label: inviteLabel(invite)
          })),
          { value: { kind: 'back' }, label: dim('Back') }
        ]
      })
    );

    switch (choice.kind) {
      case 'create':
        await createFlow(session);
        break;
      case 'invite':
        await inviteScreen(session, choice.invite);
        break;
      case 'back':
        return;
    }
  }
}
