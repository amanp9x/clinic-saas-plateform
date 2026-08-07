'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@clinic/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormFieldError } from './form-field-error';
import { useForgotPassword } from '@/hooks/use-auth-mutations';

export function ForgotPasswordForm() {
  const router = useRouter();
  const forgotPassword = useForgotPassword();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit((data) => {
    forgotPassword.mutate(data, {
      onSuccess: () => {
        toast.success('If that account exists, a reset code has been sent.');
        router.push(`/reset-password?email=${encodeURIComponent(data.email)}`);
      },
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register('email')} />
        <FormFieldError message={errors.email?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={forgotPassword.isPending}>
        {forgotPassword.isPending ? 'Sending…' : 'Send reset code'}
      </Button>
    </form>
  );
}
