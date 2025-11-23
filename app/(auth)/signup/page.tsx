'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
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
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/providers/auth-provider';

const signupSchema = z.object({
  fullName: z.string().min(1, 'Please enter your name'),
  email: z.string().email('Please enter a valid email address'),
});

type SignupFormValues = z.infer<typeof signupSchema>;

const SignupForm = () => {
  const { signup, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    mode: 'onBlur',
  });

  const onSubmit = async (values: SignupFormValues) => {
    try {
      await signup(values);
      toast({
        title: 'Account created',
        description: 'Let\'s set up your first workspace.',
      });
      const redirectPath = searchParams.get('redirect') ?? '/dashboard';
      router.replace(redirectPath);
    } catch (error) {
      console.error('Signup failed', error);
      toast({
        title: 'Sign up failed',
        description: 'We could not create your account. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>Start organizing your notes in seconds.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              type="text"
              autoComplete="name"
              placeholder="Jane Doe"
              disabled={isSubmitting || loading}
              {...register('fullName')}
            />
            {errors.fullName && (
              <p className="text-sm text-destructive">{errors.fullName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
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
            {isSubmitting || loading ? 'Creating account…' : 'Sign up'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => router.push('/login')}
          >
            Already have an account? Log in
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

const SignupPage = () => {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Suspense fallback={<div>Loading...</div>}>
        <SignupForm />
      </Suspense>
    </main>
  );
};

export default SignupPage;
