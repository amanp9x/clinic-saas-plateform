import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/auth-card';
import { VerifyEmailForm } from '@/components/auth/verify-email-form';

export const metadata: Metadata = { title: 'Verify email' };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <AuthCard title="Verify your email" description="Enter the code we sent to your inbox.">
      <VerifyEmailForm defaultEmail={email} />
    </AuthCard>
  );
}
