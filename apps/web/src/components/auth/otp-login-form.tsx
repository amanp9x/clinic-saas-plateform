'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { otpRequestSchema, otpVerifySchema, type OtpRequestInput } from '@clinic/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { FormFieldError } from './form-field-error';
import { useRequestOtpLogin, useVerifyOtpLogin } from '@/hooks/use-auth-mutations';
import { ApiError } from '@/lib/api-client';

export function OtpLoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const requestOtp = useRequestOtpLogin();
  const verifyOtp = useVerifyOtpLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OtpRequestInput>({ resolver: zodResolver(otpRequestSchema) });

  const onRequest = handleSubmit((data) => {
    requestOtp.mutate(data, {
      onSuccess: () => {
        setIdentifier(data.identifier);
        toast.success('Code sent — check your email or phone');
      },
      onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Something went wrong'),
    });
  });

  const onVerify = () => {
    if (!identifier) return;
    const parsed = otpVerifySchema.safeParse({ identifier, code });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Enter the code you received');
      return;
    }

    verifyOtp.mutate(parsed.data, {
      onSuccess: (data) => {
        toast.success(data.isNewUser ? 'Account created — welcome!' : 'Welcome back');
        router.push('/');
      },
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : 'Invalid or expired code'),
    });
  };

  if (identifier) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Enter the code sent to <span className="text-foreground font-medium">{identifier}</span>
        </p>
        <InputOTP maxLength={6} value={code} onChange={setCode}>
          <InputOTPGroup>
            {Array.from({ length: 6 }).map((_, i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <Button
          className="w-full"
          disabled={code.length < 6 || verifyOtp.isPending}
          onClick={onVerify}
        >
          {verifyOtp.isPending ? 'Verifying…' : 'Verify & continue'}
        </Button>
        <button
          type="button"
          className="text-muted-foreground text-sm hover:underline"
          onClick={() => {
            setIdentifier(null);
            setCode('');
          }}
        >
          Use a different email or phone
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onRequest} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="identifier">Email or phone number</Label>
        <Input
          id="identifier"
          placeholder="you@example.com or +919876543210"
          {...register('identifier')}
        />
        <FormFieldError message={errors.identifier?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={requestOtp.isPending}>
        {requestOtp.isPending ? 'Sending code…' : 'Send code'}
      </Button>
    </form>
  );
}
