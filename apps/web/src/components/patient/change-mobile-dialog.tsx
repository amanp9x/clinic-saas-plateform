'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { phoneSchema } from '@clinic/shared';
import {
  useConfirmMobileChange,
  useRequestMobileChange,
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

export function ChangeMobileDialog({ currentPhone }: { currentPhone: string | null }) {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<'request' | 'confirm'>('request');
  const [newPhone, setNewPhone] = React.useState('');
  const [code, setCode] = React.useState('');
  const requestChange = useRequestMobileChange();
  const confirmChange = useConfirmMobileChange();

  const reset = () => {
    setStep('request');
    setNewPhone('');
    setCode('');
  };

  const onRequest = () => {
    const parsed = phoneSchema.safeParse(newPhone);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Enter a valid phone number');
      return;
    }
    requestChange.mutate(parsed.data, {
      onSuccess: () => {
        toast.success('Verification code sent to your new number');
        setStep('confirm');
      },
      onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not send code'),
    });
  };

  const onConfirm = () => {
    confirmChange.mutate(
      { newPhone, code },
      {
        onSuccess: () => {
          toast.success('Mobile number updated');
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
          {currentPhone ? 'Change' : 'Add mobile'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{step === 'request' ? 'Change mobile number' : 'Verify new number'}</DialogTitle>
          <DialogDescription>
            {step === 'request'
              ? "We'll send a verification code to your new mobile number."
              : `Enter the 6-digit code sent to ${newPhone}.`}
          </DialogDescription>
        </DialogHeader>

        {step === 'request' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPhone">New mobile number</Label>
              <Input
                id="newPhone"
                type="tel"
                placeholder="+919876543210"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                autoComplete="tel"
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
