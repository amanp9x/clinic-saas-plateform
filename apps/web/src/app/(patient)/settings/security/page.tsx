import { ChangePasswordForm } from '@/components/auth/change-password-form';
import { SessionsList } from '@/components/auth/sessions-list';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SecuritySettingsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Changing your password signs you out of all other devices.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Devices &amp; sessions</CardTitle>
          <CardDescription>Places where you&apos;re currently signed in.</CardDescription>
        </CardHeader>
        <CardContent>
          <SessionsList />
        </CardContent>
      </Card>
    </div>
  );
}
