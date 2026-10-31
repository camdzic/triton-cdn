import { z } from 'zod';

export const SESSION_TOKEN_PREFIX = 'trs_';
export const UPLOAD_TOKEN_PREFIX = 'tru_';
export const SESSION_COOKIE = 'triton_session';
export const SIGNED_IN_COOKIE = 'triton_signed_in';
export const GUEST_PATHS = ['/login', '/register'] as const;
export const MEMBER_PATHS = [
  '/',
  '/invites',
  '/sharex',
  '/embeds',
  '/account'
] as const;
export const WEB_CLIENT_HEADER = 'x-triton-client';
export const WEB_CLIENT = 'web';
export const EMBED_VARIABLES = [
  'filename',
  'size',
  'date',
  'time',
  'username'
] as const;
export const DEFAULT_EMBED_COLOR = '#a78bfa';

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
const EMBED_COLOR_PATTERN = /^#[0-9a-f]{6}$/;
const EMBED_VARIABLE_PATTERN = /\{(?:filename|size|date|time|username)\}/g;
const EMBED_DAY_FORMAT = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeZone: 'UTC'
});
const EMBED_TIME_FORMAT = new Intl.DateTimeFormat('en', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'UTC'
});

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;

const username = z
  .string({ error: 'Username is required' })
  .trim()
  .toLowerCase()
  .min(3, 'Username must be at least 3 characters')
  .max(32, 'Username must be at most 32 characters')
  .regex(
    USERNAME_PATTERN,
    'Use letters, numbers, dots, dashes or underscores, starting and ending with a letter or number'
  );

const loginUsername = z
  .string({ error: 'Username is required' })
  .trim()
  .toLowerCase()
  .min(1, 'Username is required')
  .max(254);

const VANITY_PATTERN = /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/;
const VANITY_EXTENSION = /\.[a-z0-9]{1,16}$/;

const RESERVED_VANITIES: ReadonlySet<string> = new Set([
  ...[...GUEST_PATHS, ...MEMBER_PATHS].map((path) => path.slice(1)),
  '404',
  'admin',
  'api',
  'assets',
  'dashboard',
  'favicon',
  'files',
  'icon',
  'index',
  'logout',
  'public',
  'robots',
  'settings',
  'signin',
  'signup',
  'sitemap',
  'static'
]);

export const vanitySchema = z
  .string({ error: 'Link is required' })
  .trim()
  .toLowerCase()
  .overwrite((value) => value.replace(VANITY_EXTENSION, ''))
  .min(3, 'Link must be at least 3 characters')
  .max(64, 'Link must be at most 64 characters')
  .regex(
    VANITY_PATTERN,
    'Use letters, numbers, dashes or underscores, starting and ending with a letter or number'
  )
  .refine((value) => !RESERVED_VANITIES.has(value), 'This link is reserved');

const timestamp = z.iso.datetime();

export const registerInputSchema = z.object({
  username,
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .max(256, 'Password must be at most 256 characters'),
  invite: z.string().trim().min(1, 'Invite code is required').max(128)
});

export const loginInputSchema = z.object({
  username: loginUsername,
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
  filename: z.string().trim().min(1, 'Filename is required').max(255),
  private: z.stringbool().default(false)
});

export const updateFileInputSchema = z
  .object({
    vanity: vanitySchema.nullable().optional(),
    private: z.boolean().optional()
  })
  .refine(
    (input) => input.vanity !== undefined || input.private !== undefined,
    'Nothing to update'
  );

function embedText(label: string, max: number) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`);
}

export const embedSettingsSchema = z.object({
  enabled: z.boolean(),
  color: z
    .string()
    .trim()
    .toLowerCase()
    .regex(EMBED_COLOR_PATTERN, 'Use a hex color like #a78bfa'),
  siteName: embedText('Site name', 100),
  author: embedText('Author', 100),
  title: embedText('Title', 200),
  description: embedText('Description', 350)
});

export const oEmbedSchema = z.object({
  version: z.literal('1.0'),
  type: z.literal('link'),
  author_name: z.string().optional(),
  provider_name: z.string().optional()
});

export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: z.enum(['admin', 'user']),
  createdAt: timestamp
});

export const sessionSchema = z.object({
  token: z.string(),
  user: userSchema
});

export const webSessionSchema = z.object({
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
  vanity: z.string().nullable(),
  private: z.boolean(),
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
  username: z.string(),
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
export type UpdateFileInput = z.input<typeof updateFileInputSchema>;
export type EmbedSettings = z.infer<typeof embedSettingsSchema>;
export type EmbedVariable = (typeof EMBED_VARIABLES)[number];
export type OEmbed = z.infer<typeof oEmbedSchema>;
export type User = z.infer<typeof userSchema>;
export type Role = User['role'];
export type Session = z.infer<typeof sessionSchema>;
export type WebSession = z.infer<typeof webSessionSchema>;
export type Account = z.infer<typeof accountSchema>;
export type FileEntry = z.infer<typeof fileEntrySchema>;
export type FilePage = z.infer<typeof filePageSchema>;
export type UploadToken = z.infer<typeof uploadTokenSchema>;
export type InviteAccount = z.infer<typeof inviteAccountSchema>;
export type Invite = z.infer<typeof inviteSchema>;
export type CreatedInvite = z.infer<typeof createdInviteSchema>;
export type Ok = z.infer<typeof okSchema>;
export type APIError = z.infer<typeof apiErrorSchema>;

export const DEFAULT_EMBED: EmbedSettings = {
  enabled: false,
  color: DEFAULT_EMBED_COLOR,
  siteName: '',
  author: '',
  title: '{filename}',
  description: ''
};

export function formatBytes(bytes: number) {
  let value = bytes;
  let unit = 0;

  while (value >= 1000 && unit < BYTE_UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }

  const digits = unit === 0 || value >= 100 ? 0 : 1;

  return `${value.toFixed(digits)} ${BYTE_UNITS[unit]}`;
}

export function embedValues(
  file: { name: string; size: number; createdAt: Date },
  username: string
): Record<EmbedVariable, string> {
  return {
    filename: file.name,
    size: formatBytes(file.size),
    date: EMBED_DAY_FORMAT.format(file.createdAt),
    time: `${EMBED_TIME_FORMAT.format(file.createdAt)} UTC`,
    username
  };
}

export function fillEmbedText(
  template: string,
  values: Record<EmbedVariable, string>
) {
  return template.replace(
    EMBED_VARIABLE_PATTERN,
    (match) => values[match.slice(1, -1) as EmbedVariable]
  );
}
