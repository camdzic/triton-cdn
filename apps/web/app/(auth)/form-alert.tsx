import { FieldError } from '@/components/ui/field';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface Failure {
  message: string;
  attempt: number;
}

export function nextFailure(current: Failure | null, error: unknown) {
  return {
    message: errorMessage(error),
    attempt: current === null ? 1 : current.attempt + 1
  };
}

export function FormAlert({ failure }: { failure: Failure | null }) {
  if (failure === null) {
    return null;
  }

  return (
    <FieldError
      key={failure.attempt}
      className={cn(
        'bg-destructive/10 rounded-lg px-3 py-2',
        failure.attempt > 1
          ? 'animate-shake'
          : 'animate-in fade-in slide-in-from-top-1 duration-200'
      )}
    >
      {failure.message}
    </FieldError>
  );
}
