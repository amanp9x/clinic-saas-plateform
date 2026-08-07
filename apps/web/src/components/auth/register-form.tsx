'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { registerSchema, type RegisterInput } from '@clinic/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from './password-input';
import { FormFieldError } from './form-field-error';
import { useRegister } from '@/hooks/use-auth-mutations';
import { ApiError } from '@/lib/api-client';

export function RegisterForm() {
  const router = useRouter();
  const registerMutation = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit((data) => {
    registerMutation.mutate(data, {
      onSuccess: () => {
        toast.success('Account created. Check your email for a verification code.');
        router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
      },
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : 'Something went wrong');
      },
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" autoComplete="name" {...register('fullName')} />
        <FormFieldError message={errors.fullName?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register('email')} />
        <FormFieldError message={errors.email?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input id="phone" type="tel" placeholder="+919876543210" {...register('phone')} />
        <FormFieldError message={errors.phone?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput id="password" autoComplete="new-password" {...register('password')} />
        <FormFieldError message={errors.password?.message} />
      </div>

      <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
        {registerMutation.isPending ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}
