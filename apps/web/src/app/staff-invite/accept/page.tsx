'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAcceptStaffInvitation } from '@/hooks/clinic/use-clinic-staff';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api-client';

function AcceptContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const accept = useAcceptStaffInvitation();

  if (!token) {
    return (
      <Card className="mx-auto mt-16 max-w-md">
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">This invitation link is missing its token.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto mt-16 max-w-md">
      <CardHeader>
        <CardTitle>Accept your staff invitation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Your full name</Label>
          <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Set a password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
          <p className="text-muted-foreground text-xs">If you already have an account with this email, this password is ignored — just sign in as usual afterwards.</p>
        </div>
        <Button
          className="w-full"
          disabled={!fullName.trim() || password.length < 8 || accept.isPending}
          onClick={() =>
            accept.mutate(
              { token, fullName, password },
              {
                onSuccess: () => {
                  toast.success('Invitation accepted — you can now log in');
                  router.push('/login');
                },
                onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not accept invitation'),
              },
            )
          }
        >
          {accept.isPending ? 'Accepting…' : 'Accept & Create Account'}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function StaffInviteAcceptPage() {
  return (
    <Suspense fallback={null}>
      <AcceptContent />
    </Suspense>
  );
}
