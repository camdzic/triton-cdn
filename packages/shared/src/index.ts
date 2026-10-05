import { z } from 'zod';

export const SESSION_TOKEN_PREFIX = 'trs_';
export const UPLOAD_TOKEN_PREFIX = 'tru_';

const email = z
  .email('Enter a valid email address')
  .max(254)
  .transform((value) => value.trim().toLowerCase());

const timestamp = z.iso.datetime();

export const registerInputSchema = z.object({
  email,
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .max(256, 'Password must be at most 256 characters'),
  invite: z.string().trim().min(1, 'Invite code is required').max(128)
});

export const loginInputSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(256),
  device: z.string().trim().min(1).max(64).default('CLI')
});

export const createInviteInputSchema = z.object({
  expiresInDays: z.number().int().min(1).max(365).default(7)
});

export const listFilesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0)
});

export const uploadQuerySchema = z.object({
  filename: z.string().trim().min(1, 'Filename is required').max(255)
});

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(['admin', 'user']),
  createdAt: timestamp
});

export const sessionSchema = z.object({
  token: z.string(),
  user: userSchema
});

export const accountSchema = z.object({
  user: userSchema,
  usage: z.object({
    files: z.number().int(),
    bytes: z.number().int()
  })
});

export const fileEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  contentType: z.string(),
  size: z.number().int(),
  url: z.url(),
  createdAt: timestamp
});

export const filePageSchema = z.object({
  files: z.array(fileEntrySchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int()
});

export const uploadTokenSchema = z.object({
  token: z.string()
});

export const inviteAccountSchema = z.object({
  email: z.string(),
  files: z.number().int(),
  bytes: z.number().int()
});

export const inviteSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('open'),
    id: z.string(),
    code: z.string(),
    createdAt: timestamp,
    expiresAt: timestamp
  }),
  z.object({
    status: z.literal('used'),
    id: z.string(),
    createdAt: timestamp,
    usedAt: timestamp,
    account: inviteAccountSchema
  }),
  z.object({
    status: z.literal('expired'),
    id: z.string(),
    createdAt: timestamp,
    expiresAt: timestamp
  })
]);

export const createdInviteSchema = z.object({
  code: z.string(),
  invite: inviteSchema
});

export const okSchema = z.object({ ok: z.literal(true) });

export const apiErrorSchema = z.object({ error: z.string() });

export type RegisterInput = z.input<typeof registerInputSchema>;
export type LoginInput = z.input<typeof loginInputSchema>;
export type CreateInviteInput = z.input<typeof createInviteInputSchema>;
export type User = z.infer<typeof userSchema>;
export type Role = User['role'];
export type Session = z.infer<typeof sessionSchema>;
export type Account = z.infer<typeof accountSchema>;
export type FileEntry = z.infer<typeof fileEntrySchema>;
export type FilePage = z.infer<typeof filePageSchema>;
export type UploadToken = z.infer<typeof uploadTokenSchema>;
export type InviteAccount = z.infer<typeof inviteAccountSchema>;
export type Invite = z.infer<typeof inviteSchema>;
export type CreatedInvite = z.infer<typeof createdInviteSchema>;
export type Ok = z.infer<typeof okSchema>;
export type APIError = z.infer<typeof apiErrorSchema>;
