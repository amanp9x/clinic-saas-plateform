import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/auth-card';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <AuthCard
      title="Sign in"
      description="Enter your email and password to continue."
      footer={
        <div className="space-y-2">
          <p>
            <Link href="/otp-login" className="text-foreground hover:underline">
              Sign in with a one-time code instead
            </Link>
          </p>
          <p>
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-foreground hover:underline">
              Create one
            </Link>
          </p>
        </div>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
