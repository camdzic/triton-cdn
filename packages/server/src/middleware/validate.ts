import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { z } from 'zod';

interface Issues {
  issues: readonly { message: string }[];
}

function firstIssue({ issues }: Issues) {
  const [issue] = issues;

  return issue ? issue.message : 'Invalid request';
}

export function validate<
  Target extends keyof ValidationTargets,
  Schema extends z.ZodType
>(target: Target, schema: Schema) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json({ error: firstIssue(result.error) }, 400);
    }
  });
}
