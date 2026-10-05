import type { Invite, InviteAccount } from '@triton/shared';
import type { FileRow, InviteRow, UserRow } from '../db/schema';

const EXTENSION_PATTERN = /\.[A-Za-z0-9]{1,16}$/;

function extensionOf(name: string) {
  const match = EXTENSION_PATTERN.exec(name);

  return match ? match[0].toLowerCase() : '';
}

export function fileUrl(base: string, id: string, name: string) {
  return `${base}/${id}${extensionOf(name)}`;
}

export function toUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: row.createdAt.toISOString()
  };
}

export async function toInvite(
  row: InviteRow,
  account: InviteAccount | null,
  revealCode: () => Promise<string>
): Promise<Invite> {
  if (row.usedAt) {
    if (!account) {
      throw new Error(`Invite ${row.id} is used but has no account`);
    }

    return {
      status: 'used',
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      usedAt: row.usedAt.toISOString(),
      account
    };
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    return {
      status: 'expired',
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString()
    };
  }

  return {
    status: 'open',
    id: row.id,
    code: await revealCode(),
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString()
  };
}

export function toFileEntry(row: FileRow, name: string, base: string) {
  return {
    id: row.id,
    name,
    contentType: row.contentType,
    size: row.size,
    url: fileUrl(base, row.id, name),
    createdAt: row.createdAt.toISOString()
  };
}
