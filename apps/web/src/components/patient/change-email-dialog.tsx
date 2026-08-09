'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { emailSchema } from '@clinic/shared';
import {
  useConfirmEmailChange,
  useRequestEmailChange,
} from '@/hooks/patient/use-patient-profile';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function ChangeEmailDialog({ currentEmail }: { currentEmail: string | null }) {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<'request' | 'confirm'>('request');
  const [newEmail, setNewEmail] = React.useState('');
  const [code, setCode] = React.useState('');
  const requestChange = useRequestEmailChange();
  const confirmChange = useConfirmEmailChange();

  const reset = () => {
    setStep('request');
    setNewEmail('');
    setCode('');
  };

  const onRequest = () => {
    const parsed = emailSchema.safeParse(newEmail);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Enter a valid email');
      return;
    }
    requestChange.mutate(parsed.data, {
      onSuccess: () => {
        toast.success('Verification code sent to your new email');
        setStep('confirm');
      },
      onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not send code'),
    });
  };

  const onConfirm = () => {
    confirmChange.mutate(
      { newEmail, code },
      {
        onSuccess: () => {
          toast.success('Email updated');
          setOpen(false);
          reset();
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Invalid or expired code'),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {currentEmail ? 'Change' : 'Add email'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{step === 'request' ? 'Change email' : 'Verify new email'}</DialogTitle>
          <DialogDescription>
            {step === 'request'
              ? "We'll send a verification code to your new email address."
              : `Enter the 6-digit code sent to ${newEmail}.`}
          </DialogDescription>
        </DialogHeader>

        {step === 'request' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newEmail">New email</Label>
              <Input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={onRequest} disabled={requestChange.isPending}>
                {requestChange.isPending ? 'Sending…' : 'Send code'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Verification code</Label>
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('request')}>
                Back
              </Button>
              <Button onClick={onConfirm} disabled={confirmChange.isPending || code.length < 6}>
                {confirmChange.isPending ? 'Verifying…' : 'Verify & update'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
