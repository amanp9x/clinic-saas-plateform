'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { resetPasswordSchema, type ResetPasswordInput } from '@clinic/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from './password-input';
import { FormFieldError } from './form-field-error';
import { useResetPassword } from '@/hooks/use-auth-mutations';
import { ApiError } from '@/lib/api-client';

export function ResetPasswordForm({ defaultEmail }: { defaultEmail?: string }) {
  const router = useRouter();
  const resetPassword = useResetPassword();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: defaultEmail ?? '' },
  });

  const onSubmit = handleSubmit((data) => {
    resetPassword.mutate(data, {
      onSuccess: () => {
        toast.success('Password reset. Please log in.');
        router.push('/login');
      },
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : 'Could not reset password');
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

      <div className="space-y-2">
        <Label htmlFor="code">Reset code</Label>
        <Input id="code" inputMode="numeric" autoComplete="one-time-code" {...register('code')} />
        <FormFieldError message={errors.code?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <PasswordInput id="newPassword" autoComplete="new-password" {...register('newPassword')} />
        <FormFieldError message={errors.newPassword?.message} />
      </div>

      <Button type="submit" className="w-full" disabled={resetPassword.isPending}>
        {resetPassword.isPending ? 'Resetting…' : 'Reset password'}
      </Button>
    </form>
  );
}
