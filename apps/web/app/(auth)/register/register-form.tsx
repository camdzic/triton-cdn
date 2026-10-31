'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { registerInputSchema } from '@triton/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { PasswordInput } from '@/components/password-input';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import { type FieldErrors, fieldErrors } from '@/lib/validation';
import { AuthCard } from '../auth-card';
import { type Failure, FormAlert, nextFailure } from '../form-alert';

export function RegisterForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [invite, setInvite] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const submitting = useRef(false);
  const inviteInput = useRef<HTMLInputElement>(null);
  const usernameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    const prefilled = code !== null && code !== '';

    if (prefilled) {
      setInvite(code);
    }

    const target = prefilled ? usernameInput.current : inviteInput.current;

    if (target !== null) {
      target.focus();
    }
  }, []);

  const register = useMutation({
    mutationFn: api.register,
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

    const parsed = registerInputSchema.safeParse({
      username,
      password,
      invite
    });
    const next = parsed.success ? {} : fieldErrors(parsed.error);

    if (confirm !== password && next.password === undefined) {
      next.confirm = 'Passwords do not match';
    }

    setErrors(next);

    if (parsed.success && next.confirm === undefined) {
      submitting.current = true;
      register.mutate(parsed.data);
    } else {
      setFailure(null);
    }
  }

  return (
    <AuthCard
      title="Create your account"
      description="Registration is invite-only. Paste the code you were given."
      footer={
        <>
          Already have an account?{' '}
          <Link
            href="/login"
            className="-my-2 inline-block py-2 text-foreground font-medium underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <FieldGroup>
          <Field data-invalid={errors.invite !== undefined}>
            <FieldLabel htmlFor="invite">Invite code</FieldLabel>
            <Input
              id="invite"
              autoComplete="off"
              spellCheck={false}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="font-mono tracking-wider"
              value={invite}
              onChange={(event) => setInvite(event.target.value)}
              aria-invalid={errors.invite !== undefined}
              ref={inviteInput}
            />
            <FieldError>{errors.invite}</FieldError>
          </Field>
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
              ref={usernameInput}
            />
            {errors.username === undefined ? (
              <FieldDescription>
                3 to 32 letters, numbers, dots, dashes or underscores.
              </FieldDescription>
            ) : (
              <FieldError>{errors.username}</FieldError>
            )}
          </Field>
          <Field data-invalid={errors.password !== undefined}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={errors.password !== undefined}
            />
            {errors.password === undefined ? (
              <FieldDescription>At least 10 characters.</FieldDescription>
            ) : (
              <FieldError>{errors.password}</FieldError>
            )}
          </Field>
          <Field data-invalid={errors.confirm !== undefined}>
            <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              aria-invalid={errors.confirm !== undefined}
            />
            <FieldError>{errors.confirm}</FieldError>
          </Field>
          <FormAlert failure={failure} />
          <Button type="submit" size="lg">
            Create account
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
