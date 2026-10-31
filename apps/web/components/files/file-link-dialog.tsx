'use client';

import { type FileEntry, vanitySchema } from '@triton/shared';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel
} from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText
} from '@/components/ui/input-group';
import { Spinner } from '@/components/ui/spinner';
import { notify } from '@/lib/activity';
import { errorMessage } from '@/lib/api';
import { useUpdateFile } from '@/lib/queries';

function linkSuffix(file: FileEntry) {
  const { pathname } = new URL(file.url);
  const dot = pathname.lastIndexOf('.');

  return dot === -1 ? '' : pathname.slice(dot);
}

function LinkForm({ file, onDone }: { file: FileEntry; onDone: () => void }) {
  const update = useUpdateFile();
  const [value, setValue] = useState(file.vanity === null ? '' : file.vanity);
  const [failure, setFailure] = useState<string | null>(null);

  const suffix = linkSuffix(file);
  const parsed = vanitySchema.safeParse(value);
  const slug = parsed.success ? parsed.data : value.trim().toLowerCase();

  function save(vanity: string | null) {
    update.mutate(
      { id: file.id, input: { vanity } },
      {
        onSuccess(updated) {
          notify.success(
            vanity === null ? 'Custom link removed' : 'Custom link saved',
            updated.url
          );
          onDone();
        },
        onError(error) {
          setFailure(errorMessage(error));
        }
      }
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();

    if (parsed.success) {
      save(parsed.data);
      return;
    }

    const [issue] = parsed.error.issues;

    setFailure(issue === undefined ? 'Invalid link' : issue.message);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Custom link</DialogTitle>
        <DialogDescription>
          Give this file a short name. The original link keeps working.
        </DialogDescription>
      </DialogHeader>
      <Field data-invalid={failure !== null}>
        <FieldLabel htmlFor="file-link">Link name</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="file-link"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={value}
            maxLength={64}
            placeholder="my-file"
            aria-invalid={failure !== null}
            onChange={(event) => {
              setValue(event.target.value);
              setFailure(null);
            }}
          />
          {suffix === '' ? null : (
            <InputGroupAddon align="inline-end">
              <InputGroupText className="font-mono text-xs">
                {suffix}
              </InputGroupText>
            </InputGroupAddon>
          )}
        </InputGroup>
        {failure === null ? (
          <FieldDescription className="font-mono text-xs break-all">
            {new URL(file.url).origin}/{slug === '' ? 'my-file' : slug}
            {suffix}
          </FieldDescription>
        ) : (
          <FieldError>{failure}</FieldError>
        )}
      </Field>
      <DialogFooter className="sm:justify-between">
        {file.vanity === null ? (
          <span className="hidden sm:block" />
        ) : (
          <Button
            type="button"
            variant="destructive"
            disabled={update.isPending}
            onClick={() => save(null)}
          >
            Remove
          </Button>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <DialogClose
            render={<Button type="button" variant="outline" />}
            disabled={update.isPending}
          >
            Cancel
          </DialogClose>
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? <Spinner /> : null}
            Save link
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

export function FileLinkDialog({
  file,
  open,
  onOpenChange,
  onDone
}: {
  file: FileEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-[minmax(0,1fr)] sm:max-w-md">
        {file === null ? null : (
          <LinkForm key={file.id} file={file} onDone={onDone} />
        )}
      </DialogContent>
    </Dialog>
  );
}
