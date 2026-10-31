'use client';

import {
  DEFAULT_EMBED,
  DEFAULT_EMBED_COLOR,
  EMBED_VARIABLES,
  type EmbedSettings,
  embedSettingsSchema,
  embedValues,
  fillEmbedText
} from '@triton/shared';
import { RefreshCwIcon } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { useCurrentAccount } from '@/components/account-context';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle
} from '@/components/ui/empty';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/lib/activity';
import { errorMessage } from '@/lib/api';
import { useEmbed, useSaveEmbed } from '@/lib/queries';

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const SAMPLE_FILE = {
  name: 'screenshot.png',
  size: 1_284_000,
  createdAt: new Date('2026-10-31T12:00:00.000Z')
};

const TEXT_FIELDS = [
  {
    key: 'siteName',
    label: 'Site name',
    placeholder: 'spoke.pw',
    max: 100,
    hint: 'The small line at the top of the embed.'
  },
  {
    key: 'author',
    label: 'Author',
    placeholder: '{username}',
    max: 100,
    hint: 'Shown above the title.'
  },
  {
    key: 'title',
    label: 'Title',
    placeholder: '{filename}',
    max: 200,
    hint: null
  }
] as const;

function EmbedPreview({ form }: { form: EmbedSettings }) {
  const account = useCurrentAccount();
  const username = account === null ? 'you' : account.user.username;
  const values = embedValues(SAMPLE_FILE, username);
  const siteName = fillEmbedText(form.siteName, values);
  const author = fillEmbedText(form.author, values);
  const title = fillEmbedText(form.title, values);
  const description = fillEmbedText(form.description, values);
  const color = COLOR_PATTERN.test(form.color)
    ? form.color
    : DEFAULT_EMBED_COLOR;

  if (!form.enabled) {
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-[#313338] p-4">
        <div className="bg-gradient-brand aspect-video w-full rounded" />
        <p className="text-xs text-[#b5bac1]">
          Embeds are off, so links show the plain file.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-[#313338] p-4">
      <div
        className="flex flex-col gap-2 rounded border-l-4 bg-[#2b2d31] p-3 wrap-anywhere"
        style={{ borderLeftColor: color }}
      >
        {siteName === '' ? null : (
          <p className="text-xs text-[#b5bac1]">{siteName}</p>
        )}
        {author === '' ? null : (
          <p className="text-sm font-medium text-[#f2f3f5]">{author}</p>
        )}
        {title === '' ? null : (
          <p className="text-sm font-semibold text-[#00a8fc]">{title}</p>
        )}
        {description === '' ? null : (
          <p className="text-sm whitespace-pre-line text-[#dbdee1]">
            {description}
          </p>
        )}
        <div className="bg-gradient-brand aspect-video w-full rounded" />
      </div>
    </div>
  );
}

function Masked({
  loading,
  children
}: {
  loading: boolean;
  children: ReactNode;
}) {
  if (!loading) {
    return children;
  }

  return (
    <div className="relative">
      <Skeleton className="absolute inset-0" />
      <div className="invisible grid">{children}</div>
    </div>
  );
}

function EmbedForm({ settings }: { settings: EmbedSettings | undefined }) {
  const save = useSaveEmbed();
  const loading = settings === undefined;
  const [form, setForm] = useState(
    settings === undefined ? DEFAULT_EMBED : settings
  );
  const [failure, setFailure] = useState<string | null>(null);

  function change<Key extends keyof EmbedSettings>(
    key: Key,
    value: EmbedSettings[Key]
  ) {
    setForm({ ...form, [key]: value });
    setFailure(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = embedSettingsSchema.safeParse(form);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;

      setFailure(issue === undefined ? 'Invalid embed' : issue.message);
      return;
    }

    save.mutate(parsed.data, {
      onSuccess(saved) {
        setForm(saved);
        notify.success(
          'Embed saved',
          'Apps may keep showing old links for a while.'
        );
      },
      onError(error) {
        setFailure(errorMessage(error));
      }
    });
  }

  return (
    <div className="grid items-start gap-4 *:min-w-0 lg:grid-cols-5 lg:gap-6">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Link embed</CardTitle>
          <CardDescription>
            Applies to your public images. Private files never get an embed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <FieldLabel htmlFor="embed-enabled">Enable embeds</FieldLabel>
              <Masked loading={loading}>
                <Switch
                  id="embed-enabled"
                  checked={form.enabled}
                  onCheckedChange={(checked) => change('enabled', checked)}
                />
              </Masked>
            </div>
            <Field>
              <FieldLabel htmlFor="embed-color">Color</FieldLabel>
              <Masked loading={loading}>
                <div className="flex gap-2">
                  <input
                    type="color"
                    aria-label="Pick a color"
                    value={
                      COLOR_PATTERN.test(form.color)
                        ? form.color.toLowerCase()
                        : DEFAULT_EMBED_COLOR
                    }
                    onChange={(event) => change('color', event.target.value)}
                    className="border-input size-9 shrink-0 cursor-pointer rounded-lg border bg-transparent p-1"
                  />
                  <Input
                    id="embed-color"
                    value={form.color}
                    maxLength={7}
                    spellCheck={false}
                    autoComplete="off"
                    className="font-mono"
                    onChange={(event) => change('color', event.target.value)}
                  />
                </div>
              </Masked>
            </Field>
            {TEXT_FIELDS.map(({ key, label, placeholder, max, hint }) => (
              <Field key={key}>
                <FieldLabel htmlFor={`embed-${key}`}>{label}</FieldLabel>
                <Masked loading={loading}>
                  <Input
                    id={`embed-${key}`}
                    value={form[key]}
                    maxLength={max}
                    placeholder={placeholder}
                    autoComplete="off"
                    onChange={(event) => change(key, event.target.value)}
                  />
                </Masked>
                {hint === null ? null : (
                  <FieldDescription>{hint}</FieldDescription>
                )}
              </Field>
            ))}
            <Field>
              <FieldLabel htmlFor="embed-description">Description</FieldLabel>
              <Masked loading={loading}>
                <Textarea
                  id="embed-description"
                  value={form.description}
                  maxLength={350}
                  rows={3}
                  onChange={(event) =>
                    change('description', event.target.value)
                  }
                />
              </Masked>
              <FieldDescription className="flex flex-wrap items-center gap-1">
                Variables:
                {EMBED_VARIABLES.map((variable) => (
                  <Kbd key={variable}>{`{${variable}}`}</Kbd>
                ))}
              </FieldDescription>
            </Field>
            {failure === null ? null : <FieldError>{failure}</FieldError>}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={loading || save.isPending}
            >
              {save.isPending ? <Spinner /> : null}
              Save embed
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card className="lg:sticky lg:top-20 lg:col-span-2 lg:max-h-[calc(100svh-6rem)] lg:overflow-y-auto">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>Roughly how it looks on Discord.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="aspect-video w-full" />
          ) : (
            <EmbedPreview form={form} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function EmbedsPage() {
  const embed = useEmbed();

  return (
    <>
      <PageHeader
        title="Embeds"
        description="Choose how your links look when shared on Discord and other apps."
      />
      {embed.isError ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>Could not load your embed</EmptyTitle>
            <EmptyDescription>{errorMessage(embed.error)}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => embed.refetch()}>
              <RefreshCwIcon />
              Try again
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <EmbedForm
          key={embed.data === undefined ? 'loading' : 'ready'}
          settings={embed.data}
        />
      )}
    </>
  );
}
