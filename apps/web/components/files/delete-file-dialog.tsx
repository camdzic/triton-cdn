'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { FileEntry } from '@triton/shared';
import { Trash2Icon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Spinner } from '@/components/ui/spinner';
import { notify } from '@/lib/activity';
import { api, errorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/queries';

export function DeleteFileDialog({
  file,
  open,
  onOpenChange,
  onDeleted
}: {
  file: FileEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: (target: FileEntry) => api.deleteFile(target.id),
    async onSuccess(_, target) {
      notify.success('File deleted', target.name);
      onDeleted();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.files }),
        queryClient.invalidateQueries({ queryKey: queryKeys.account })
      ]);
    },
    onError(error) {
      notify.error('Could not delete the file', errorMessage(error));
    }
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="data-[size=default]:max-w-[min(20rem,calc(100%-2rem))]">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete this file?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="text-foreground font-medium break-all">
              {file === null ? '' : file.name}
            </span>{' '}
            will be removed and its link will stop working. This cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={remove.isPending || file === null}
            onClick={() => {
              if (file !== null) {
                remove.mutate(file);
              }
            }}
          >
            {remove.isPending ? <Spinner /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
