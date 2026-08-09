'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { deleteAccountSchema, type DeleteAccountInput } from '@clinic/shared';
import { useDeleteAccount } from '@/hooks/patient/use-patient-profile';
import { useLogout } from '@/hooks/use-auth-mutations';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/auth/password-input';
import { FormFieldError } from '@/components/auth/form-field-error';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function DeleteAccountDialog() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const deleteAccount = useDeleteAccount();
  const logout = useLogout();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DeleteAccountInput>({ resolver: zodResolver(deleteAccountSchema) });

  const onSubmit = handleSubmit((data) => {
    deleteAccount.mutate(data, {
      onSuccess: () => {
        toast.success('Your account has been deleted');
        logout.mutate(undefined, { onSuccess: () => router.push('/') });
      },
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : 'Could not delete account');
      },
    });
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger>
        <Button variant="destructive">Delete account</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your account</DialogTitle>
          <DialogDescription>
            This permanently deletes your profile, appointments, and medical records. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="delete-password">Confirm your password</Label>
            <PasswordInput id="delete-password" autoComplete="current-password" {...register('password')} />
            <FormFieldError message={errors.password?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="delete-reason">Reason (optional)</Label>
            <textarea
              id="delete-reason"
              rows={3}
              className="shadow-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
              {...register('reason')}
            />
            <FormFieldError message={errors.reason?.message} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Keep my account
            </Button>
            <Button type="submit" variant="destructive" disabled={deleteAccount.isPending}>
              {deleteAccount.isPending ? 'Deleting…' : 'Delete account permanently'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
