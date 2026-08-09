import { ShieldCheck } from 'lucide-react';
import { DeleteAccountDialog } from '@/components/patient/delete-account-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function PrivacySettingsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4" />
            Your data
          </CardTitle>
          <CardDescription>How your information is used.</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>
            Your profile, appointment, and medical record data is only visible to you and the clinicians
            you consult. It is used to manage your appointments, display your medical history, and send
            you the notifications you&apos;ve opted into.
          </p>
          <p>
            You can update your notification preferences at any time from the Notifications tab, and you
            can request full account deletion below.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
          <CardDescription>
            Permanently remove your account and all associated data. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountDialog />
        </CardContent>
      </Card>
    </div>
  );
}
