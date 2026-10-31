import type { z } from 'zod';

export type FieldErrors = Partial<Record<string, string>>;

export function fieldErrors(error: z.ZodError) {
  const errors: FieldErrors = {};

  for (const issue of error.issues) {
    const [field] = issue.path;

    if (typeof field === 'string' && errors[field] === undefined) {
      errors[field] = issue.message;
    }
  }

  return errors;
}
