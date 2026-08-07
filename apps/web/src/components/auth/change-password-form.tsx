'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { changePasswordSchema, type ChangePasswordInput } from '@clinic/shared';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from './password-input';
import { FormFieldError } from './form-field-error';
import { useChangePassword } from '@/hooks/use-auth-mutations';
import { ApiError } from '@/lib/api-client';

export function ChangePasswordForm() {
  const changePassword = useChangePassword();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  const onSubmit = handleSubmit((data) => {
    changePassword.mutate(data, {
      onSuccess: () => {
        toast.success('Password changed. Your other devices have been signed out.');
        reset();
      },
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : 'Could not change password');
      },
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Current password</Label>
        <PasswordInput
          id="currentPassword"
          autoComplete="current-password"
          {...register('currentPassword')}
        />
        <FormFieldError message={errors.currentPassword?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <PasswordInput id="newPassword" autoComplete="new-password" {...register('newPassword')} />
        <FormFieldError message={errors.newPassword?.message} />
      </div>

      <Button type="submit" disabled={changePassword.isPending}>
        {changePassword.isPending ? 'Updating…' : 'Update password'}
      </Button>
    </form>
  );
}
