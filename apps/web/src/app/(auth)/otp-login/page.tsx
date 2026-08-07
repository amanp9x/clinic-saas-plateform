import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/auth-card';
import { OtpLoginForm } from '@/components/auth/otp-login-form';

export const metadata: Metadata = { title: 'Sign in with a code' };

export default function OtpLoginPage() {
  return (
    <AuthCard
      title="Sign in with a code"
      description="We'll text or email you a one-time code. New here? This creates your account automatically."
      footer={
        <p>
          Prefer a password?{' '}
          <Link href="/login" className="text-foreground hover:underline">
            Sign in with password
          </Link>
        </p>
      }
    >
      <OtpLoginForm />
    </AuthCard>
  );
}
