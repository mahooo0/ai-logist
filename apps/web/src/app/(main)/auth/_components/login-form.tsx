'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

// Plan 04-02 — rewire Zenith placeholder onSubmit to POST /api/auth/login
// (route lives under /api/auth/* because Zenith already serves a page at
// /auth/v1/login). On success → router.push('/dashboard/default') (D-07).
// Email field stays in the UI (Zenith ergonomics) and is sent as `username`
// to match the ADMIN_USERNAME env contract.

const formSchema = z.object({
  email: z.string().min(1, { message: 'Username is required.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

type LoginValues = z.infer<typeof formSchema>;

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: LoginValues) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: values.email, password: values.password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? 'login_failed');
        return;
      }
      router.push('/dashboard/default');
    } catch (_err) {
      setError('network_error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-email">Username</FieldLabel>
              <Input
                {...field}
                id="login-email"
                type="text"
                placeholder="admin"
                autoComplete="username"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-password">Password</FieldLabel>
              <Input
                {...field}
                id="login-password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-sm"
        >
          {error === 'invalid_credentials' && 'Invalid username or password.'}
          {error === 'invalid_input' && 'Please fill in both fields.'}
          {error === 'server_misconfigured' &&
            'Server is missing ADMIN_USERNAME / ADMIN_PASSWORD_HASH env vars.'}
          {error === 'network_error' && 'Network error — please retry.'}
          {![
            'invalid_credentials',
            'invalid_input',
            'server_misconfigured',
            'network_error',
          ].includes(error) && 'Login failed.'}
        </div>
      )}
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? 'Signing in…' : 'Login'}
      </Button>
    </form>
  );
}
