'use client';

import { useMutation } from '@tanstack/react-query';
import {
  DownloadIcon,
  FileCogIcon,
  KeyRoundIcon,
  MousePointerClickIcon,
  TerminalIcon
} from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { z } from 'zod';
import { CopyCommand } from '@/components/copy-command';
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
  Field,
  FieldDescription,
  FieldError,
  FieldLabel
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { notify } from '@/lib/activity';
import { api, errorMessage } from '@/lib/api';
import { saveFile } from '@/lib/browser';
import { sharexConfig, sharexFileName } from '@/lib/sharex';

const nameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(64, 'Name must be at most 64 characters');

const STEPS = [
  {
    icon: DownloadIcon,
    title: 'Download the config',
    body: 'A .sxcu file with your server URL and upload token.'
  },
  {
    icon: MousePointerClickIcon,
    title: 'Open it',
    body: 'Double-click the file. ShareX asks to add the uploader, accept it.'
  },
  {
    icon: FileCogIcon,
    title: 'Make it the default',
    body: 'In Destinations, pick triton as the image, text and file uploader.'
  }
];

export function SharexPage() {
  const [name, setName] = useState('ShareX');
  const [error, setError] = useState<string | null>(null);

  const download = useMutation({
    mutationFn: api.uploadToken,
    onError(failure) {
      notify.error('Could not prepare the config', errorMessage(failure));
    }
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = nameSchema.safeParse(name);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;

      setError(issue === undefined ? 'Invalid name' : issue.message);
      return;
    }

    setError(null);

    download.mutate(undefined, {
      onSuccess({ token }) {
        const config = sharexConfig(window.location.origin, token, parsed.data);

        saveFile(
          sharexFileName(parsed.data),
          `${JSON.stringify(config, null, 2)}\n`,
          'application/json'
        );

        notify.success(
          'ShareX config downloaded',
          'Open the file to import it into ShareX.'
        );
      }
    });
  }

  return (
    <>
      <PageHeader
        title="ShareX"
        description="Upload screenshots and files straight from ShareX on Windows."
      />
      <div className="grid gap-4 *:min-w-0 lg:grid-cols-5 lg:gap-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Custom uploader</CardTitle>
            <CardDescription>
              Every config shares your account&apos;s upload token. It can only
              upload, it cannot list, open or delete your files.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} noValidate className="flex flex-col gap-4">
              <Field data-invalid={error !== null}>
                <FieldLabel htmlFor="sharex-name">Uploader name</FieldLabel>
                <Input
                  id="sharex-name"
                  value={name}
                  maxLength={64}
                  onChange={(event) => setName(event.target.value)}
                  aria-invalid={error !== null}
                />
                {error === null ? (
                  <FieldDescription className="break-all">
                    Shown in ShareX as &ldquo;triton · {name.trim() || '…'}
                    &rdquo;.
                  </FieldDescription>
                ) : (
                  <FieldError>{error}</FieldError>
                )}
              </Field>
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={download.isPending}
              >
                {download.isPending ? <Spinner /> : <DownloadIcon />}
                Download .sxcu
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>How to import</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-4">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="text-muted-foreground text-sm">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TerminalIcon className="size-4" />
              Prefer the terminal?
            </CardTitle>
            <CardDescription>
              The CLI finds ShareX on this computer and imports the uploader for
              you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CopyCommand command="triton sharex" />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRoundIcon className="size-4" />
              Keep it private
            </CardTitle>
            <CardDescription>
              Anyone holding the file can upload to your account. Don&apos;t
              share it or commit it to a repository.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </>
  );
}
