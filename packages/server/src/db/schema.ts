import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'user'] })
    .notNull()
    .default('user'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
});

export const tokens = sqliteTable(
  'tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    hash: text('hash').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull()
  },
  (table) => [index('tokens_user_idx').on(table.userId)]
);

export const invites = sqliteTable('invites', {
  id: text('id').primaryKey(),
  hash: text('hash').notNull().unique(),
  code: text('code').notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  usedBy: text('used_by').references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  usedAt: integer('used_at', { mode: 'timestamp_ms' })
});

export const files = sqliteTable(
  'files',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    wrappedKey: text('wrapped_key').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
  },
  (table) => [index('files_user_created_idx').on(table.userId, table.createdAt)]
);

export type UserRow = typeof users.$inferSelect;
export type InviteRow = typeof invites.$inferSelect;
export type FileRow = typeof files.$inferSelect;
