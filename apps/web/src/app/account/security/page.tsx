'use client';

import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ChangePasswordForm } from '@/components/auth/change-password-form';
import { SessionsList } from '@/components/auth/sessions-list';
import { useLogout, useLogoutAllDevices } from '@/hooks/use-auth-mutations';
import { useAuth } from '@/hooks/use-auth';

export default function SecurityPage() {
  const router = useRouter();
  const { user } = useAuth();
  const logout = useLogout();
  const logoutAll = useLogoutAllDevices();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account security</h1>
        <p className="text-muted-foreground text-sm">Signed in as {user?.email ?? user?.phone}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Changing your password signs you out of every other device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>Devices currently signed in to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <SessionsList />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sign out</CardTitle>
          <CardDescription>End your session on this device, or everywhere at once.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={logout.isPending}
            onClick={() =>
              logout.mutate(undefined, {
                onSuccess: () => router.push('/login'),
              })
            }
          >
            Sign out of this device
          </Button>
          <Separator orientation="vertical" className="h-9" />
          <Button
            variant="destructive"
            disabled={logoutAll.isPending}
            onClick={() =>
              logoutAll.mutate(undefined, {
                onSuccess: (data) => {
                  toast.success(`Signed out of ${data.sessionsRevoked} device(s)`);
                  router.push('/login');
                },
              })
            }
          >
            Sign out of all devices
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
