import { log, select } from '@clack/prompts';
import type { Account } from '@triton/shared';
import { APIError } from '../lib/api';
import { formatBytes } from '../lib/format';
import { closeFrame, openFrame } from '../lib/frame';
import { ask, errorMessage, orBack, reportError, task } from '../lib/prompt';
import {
  carry,
  enterScreen,
  freshScreen,
  leaveScreen,
  persist
} from '../lib/screen';
import { currentSession, forgetSession, type Session } from '../lib/session';
import { brand, dim, gradient, red } from '../lib/theme';
import { loginFlow, logoutFlow, registerFlow } from './auth';
import { browseFlow } from './files';
import { invitesFlow } from './invites';
import { sharexFlow } from './sharex';
import { uploadFlow } from './upload';

type GuestAction = 'login' | 'register' | 'quit';
type MemberAction =
  | 'upload'
  | 'browse'
  | 'sharex'
  | 'invites'
  | 'logout'
  | 'quit';

async function guestMenu() {
  const action = await orBack(async () =>
    ask(
      await select<GuestAction>({
        message: 'Welcome to triton',
        options: [
          { value: 'login', label: 'Log in' },
          {
            value: 'register',
            label: 'Create an account',
            hint: 'needs an invite code'
          },
          { value: 'quit', label: dim('Quit') }
        ]
      })
    )
  );

  switch (action) {
    case 'login':
      return orBack(() => loginFlow());
    case 'register':
      return orBack(() => registerFlow());
    default:
      return 'quit';
  }
}

function summary(account: Account) {
  return `${brand(account.user.email)} ${dim(`· ${account.usage.files} files · ${formatBytes(account.usage.bytes)}`)}`;
}

async function memberMenu(session: Session, account: Account) {
  const action = await orBack(async () =>
    ask(
      await select<MemberAction>({
        message: summary(account),
        options: [
          { value: 'upload', label: 'Upload a file' },
          {
            value: 'browse',
            label: 'Browse uploads',
            hint: 'preview, copy, delete'
          },
          { value: 'sharex', label: 'ShareX config' },
          ...(account.user.role === 'admin'
            ? [{ value: 'invites' as const, label: 'Invites', hint: 'admin' }]
            : []),
          { value: 'logout', label: 'Log out' },
          { value: 'quit', label: dim('Quit') }
        ]
      })
    )
  );

  switch (action) {
    case 'upload':
      await orBack(() => uploadFlow(session.api));
      return session;
    case 'browse':
      await orBack(() => browseFlow(session.api));
      return session;
    case 'sharex':
      await orBack(() => sharexFlow(session));
      return session;
    case 'invites':
      await orBack(() => invitesFlow(session));
      return session;
    case 'logout':
      await logoutFlow(session);
      return null;
    default:
      return 'quit';
  }
}

export async function interactive() {
  if (!enterScreen()) {
    openFrame();
  }

  let session = await currentSession();

  let farewell = gradient('see you soon');

  while (true) {
    freshScreen();

    try {
      if (!session) {
        const next = await guestMenu();

        if (next === 'quit') {
          break;
        }

        session = next;

        continue;
      }

      const active = session;

      const account = await task('Loading account', () => active.api.account());
      const next = await memberMenu(active, account);

      if (next === 'quit') {
        break;
      }

      session = next;
    } catch (error) {
      if (error instanceof APIError && error.status === 401 && session) {
        await forgetSession(session);

        session = null;

        carry(() => log.warn('Your session has expired, please log in again'));

        continue;
      }

      if (error instanceof APIError && error.status === 0) {
        farewell = red(errorMessage(error));

        break;
      }

      persist(() => reportError(error));
    }
  }

  if (leaveScreen()) {
    openFrame();
  }

  closeFrame(farewell);
}
