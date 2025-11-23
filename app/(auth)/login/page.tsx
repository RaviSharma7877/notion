'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Suspense } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/providers/auth-provider';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long'),
  rememberMe: z.boolean(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const LoginForm = () => {
  const { login, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await login({
        email: values.email,
        password: values.password,
        rememberMe: values.rememberMe,
      });
      toast({ title: 'Welcome back!' });
      const redirectPath = searchParams.get('redirect') ?? '/dashboard';
      router.replace(redirectPath);
    } catch (error) {
      console.error('Login failed', error);
      toast({
        title: 'Login failed',
        description:
          error instanceof Error
            ? error.message
            : 'Please verify your credentials and try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Log in</CardTitle>
        <CardDescription>Access your workspaces and continue where you left off.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
              disabled={isSubmitting || loading}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={isSubmitting || loading}
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          <Controller
            name="rememberMe"
            control={control}
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="rememberMe"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                  disabled={isSubmitting || loading}
                />
                <Label
                  htmlFor="rememberMe"
                  className="text-sm font-normal text-muted-foreground"
                >
                  Remember me on this device
                </Label>
              </div>
            )}
          />
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || loading}
          >
            {isSubmitting || loading ? 'Logging in…' : 'Log in'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => router.push('/signup')}
          >
            Create an account
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

const LoginPage = () => {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Suspense fallback={<div>Loading...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
};

export default LoginPage;
