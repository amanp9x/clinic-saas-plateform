'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { verifyEmailSchema } from '@clinic/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useResendEmailVerification, useVerifyEmail } from '@/hooks/use-auth-mutations';
import { ApiError } from '@/lib/api-client';

export function VerifyEmailForm({ defaultEmail }: { defaultEmail?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [code, setCode] = useState('');
  const verifyEmail = useVerifyEmail();
  const resend = useResendEmailVerification();

  const onSubmit = () => {
    const parsed = verifyEmailSchema.safeParse({ email, code });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Enter a valid email and code');
      return;
    }

    verifyEmail.mutate(parsed.data, {
      onSuccess: () => {
        toast.success('Email verified');
        router.push('/');
      },
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : 'Invalid or expired code'),
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>

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

      <Button className="w-full" onClick={onSubmit} disabled={verifyEmail.isPending}>
        {verifyEmail.isPending ? 'Verifying…' : 'Verify email'}
      </Button>

      <button
        type="button"
        className="text-muted-foreground w-full text-center text-sm hover:underline"
        disabled={resend.isPending || !email}
        onClick={() =>
          resend.mutate(
            { email },
            { onSuccess: () => toast.success('If needed, a new code has been sent.') },
          )
        }
      >
        {resend.isPending ? 'Sending…' : "Didn't get a code? Resend"}
      </button>
    </div>
  );
}
