import {
  DEFAULT_EMBED,
  type EmbedSettings,
  embedValues,
  fillEmbedText
} from '@triton/shared';
import { eq } from 'drizzle-orm';
import { html } from 'hono/html';
import type { Database } from '../db/client';
import {
  type EmbedSettingsRow,
  embedSettings,
  type FileRow,
  users
} from '../db/schema';
import { openFile } from './stored-files';

const CRAWLER_PATTERN =
  /discordbot|twitterbot|telegrambot|slackbot|whatsapp|facebookexternalhit/i;
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);
const VIDEO_WIDTH = '1280';
const VIDEO_HEIGHT = '720';

type EmbedKind = 'image' | 'video';

export type Embed = Omit<EmbedSettings, 'enabled'> & {
  kind: EmbedKind;
  name: string;
};

function toSettings(row: EmbedSettingsRow) {
  return {
    enabled: row.enabled,
    color: row.color,
    siteName: row.siteName,
    author: row.author,
    title: row.title,
    description: row.description
  };
}

function embedKind(contentType: string): EmbedKind | null {
  if (VIDEO_TYPES.has(contentType)) {
    return 'video';
  }

  return contentType.startsWith('image/') && contentType !== 'image/svg+xml'
    ? 'image'
    : null;
}

export function isEmbedCrawler(agent: string | undefined) {
  return agent !== undefined && CRAWLER_PATTERN.test(agent);
}

export async function embedSettingsFor(db: Database, userId: string) {
  const row = await db
    .select()
    .from(embedSettings)
    .where(eq(embedSettings.userId, userId))
    .get();

  return row ? toSettings(row) : DEFAULT_EMBED;
}

export async function saveEmbedSettings(
  db: Database,
  userId: string,
  settings: EmbedSettings
) {
  const row = await db
    .insert(embedSettings)
    .values({ userId, ...settings })
    .onConflictDoUpdate({ target: embedSettings.userId, set: settings })
    .returning()
    .get();

  return toSettings(row);
}

export async function loadEmbed(
  db: Database,
  secret: string,
  row: FileRow
): Promise<Embed | null> {
  const kind = embedKind(row.contentType);

  if (row.private || kind === null) {
    return null;
  }

  const owner = await db
    .select({ settings: embedSettings, username: users.username })
    .from(embedSettings)
    .innerJoin(users, eq(users.id, embedSettings.userId))
    .where(eq(embedSettings.userId, row.userId))
    .get();

  if (!owner || !owner.settings.enabled) {
    return null;
  }

  const { name } = await openFile(secret, row);
  const { settings, username } = owner;
  const values = embedValues({ ...row, name }, username);

  return {
    kind,
    name,
    color: settings.color,
    siteName: fillEmbedText(settings.siteName, values),
    author: fillEmbedText(settings.author, values),
    title: fillEmbedText(settings.title, values),
    description: fillEmbedText(settings.description, values)
  };
}

function property(name: string, content: string) {
  return content === ''
    ? ''
    : html`<meta property="${name}" content="${content}" />`;
}

function named(name: string, content: string) {
  return content === ''
    ? ''
    : html`<meta name="${name}" content="${content}" />`;
}

function imageTags(url: string) {
  return html`
    ${property('og:image', url)} ${named('twitter:card', 'summary_large_image')}
    ${named('twitter:image', url)}
  `;
}

function videoTags(url: string, contentType: string) {
  return html`
    ${property('og:type', 'video.other')} ${property('og:video', url)}
    ${property('og:video:url', url)} ${property('og:video:secure_url', url)}
    ${property('og:video:type', contentType)}
    ${property('og:video:width', VIDEO_WIDTH)}
    ${property('og:video:height', VIDEO_HEIGHT)} ${named('twitter:card', 'player')}
    ${named('twitter:player:stream', url)}
    ${named('twitter:player:stream:content_type', contentType)}
    ${named('twitter:player:width', VIDEO_WIDTH)}
    ${named('twitter:player:height', VIDEO_HEIGHT)}
  `;
}

export function embedPage(
  embed: Embed,
  contentType: string,
  url: string,
  oEmbedUrl: string
) {
  const raw = `${url}?raw=1`;
  const hasOEmbed = embed.author !== '' || embed.siteName !== '';

  return html`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${embed.title === '' ? embed.name : embed.title}</title>
        ${named('theme-color', embed.color)}
        ${property('og:site_name', embed.siteName)}
        ${property('og:title', embed.title)}
        ${property('og:description', embed.description)}
        ${property('og:url', url)}
        ${embed.kind === 'video' ? videoTags(raw, contentType) : imageTags(raw)}
        ${
          hasOEmbed
            ? html`<link
                rel="alternate"
                type="application/json+oembed"
                href="${oEmbedUrl}"
              />`
            : ''
        }
      </head>
      <body></body>
    </html>`;
}
