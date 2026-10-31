'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { loginInputSchema } from '@triton/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useRef, useState } from 'react';
import { PasswordInput } from '@/components/password-input';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { deviceName } from '@/lib/browser';
import { queryKeys } from '@/lib/queries';
import { type FieldErrors, fieldErrors } from '@/lib/validation';
import { AuthCard } from '../auth-card';
import { type Failure, FormAlert, nextFailure } from '../form-alert';

export function LoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const submitting = useRef(false);

  const login = useMutation({
    mutationFn: api.login,
    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: queryKeys.account });
      router.replace('/');
    },
    onError(error) {
      setFailure((current) => nextFailure(current, error));
    },
    onSettled() {
      submitting.current = false;
    }
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting.current) {
      return;
    }

    const parsed = loginInputSchema.safeParse({
      username,
      password,
      device: deviceName()
    });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setFailure(null);
      return;
    }

    setErrors({});
    submitting.current = true;
    login.mutate(parsed.data);
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to manage your encrypted uploads."
      footer={
        <>
          Have an invite code?{' '}
          <Link
            href="/register"
            className="-my-2 inline-block py-2 text-foreground font-medium underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <FieldGroup>
          <Field data-invalid={errors.username !== undefined}>
            <FieldLabel htmlFor="username">Username</FieldLabel>
            <Input
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="your-name"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              aria-invalid={errors.username !== undefined}
              autoFocus
            />
            <FieldError>{errors.username}</FieldError>
          </Field>
          <Field data-invalid={errors.password !== undefined}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={errors.password !== undefined}
            />
            <FieldError>{errors.password}</FieldError>
          </Field>
          <FormAlert failure={failure} />
          <Button type="submit" size="lg">
            Sign in
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
