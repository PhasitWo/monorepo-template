import { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginBodySchema } from '@repo/shared';
import { AuthAPI } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { APP_NAME } from '@/constants';
import { useAppState } from '@/hooks/use-app-state';
import useToastError from '@/hooks/use-toast-error';

export default function Login() {
  const form = useForm({
    resolver: zodResolver(loginBodySchema),
    mode: 'onSubmit',
    defaultValues: {
      username: '',
      password: '',
    },
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toastError } = useToastError();
  const { signIn } = useAppState();
  const navigate = useNavigate();

  const handleLogin = useCallback(
    (data: { username: string; password: string }) => {
      setIsLoading(true);
      AuthAPI.login(data)
        .then((resp) => {
          if (!resp.success) {
            toastError(resp.error);
            return;
          }
          signIn(resp.data);
          navigate('/', { replace: true });
        })
        .finally(() => setIsLoading(false));
    },
    [navigate, signIn, toastError],
  );

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to {APP_NAME}</CardTitle>
        </CardHeader>
        <form noValidate onSubmit={form.handleSubmit(handleLogin)}>
          <CardContent>
            <FieldGroup>
              <Controller
                control={form.control}
                name="username"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="username">Username</FieldLabel>
                    <Input {...field} id="username" autoComplete="username" aria-invalid={fieldState.invalid} />
                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="password"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Input
                      {...field}
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </FieldGroup>
          </CardContent>
          <CardFooter className="mt-6">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Spinner /> : 'Sign in'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
