'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/providers/auth-provider';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const LoginPage = () => {
  const { login, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await login({ email: values.email });
      toast({ title: 'Welcome back!' });
      const redirectPath = searchParams.get('redirect') ?? '/dashboard';
      router.replace(redirectPath);
    } catch (error) {
      console.error('Login failed', error);
      toast({
        title: 'Login failed',
        description: 'We could not find an account with that email.',
        variant: 'destructive',
      });
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
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
    </main>
  );
};

export default LoginPage;
