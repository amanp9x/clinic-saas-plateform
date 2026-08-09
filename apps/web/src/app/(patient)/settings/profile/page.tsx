'use client';

import { usePatientProfile } from '@/hooks/patient/use-patient-profile';
import { ProfilePhotoUpload } from '@/components/patient/profile-photo-upload';
import { ProfileInfoForm } from '@/components/patient/profile-info-form';
import { ChangeEmailDialog } from '@/components/patient/change-email-dialog';
import { ChangeMobileDialog } from '@/components/patient/change-mobile-dialog';
import { AddressList } from '@/components/patient/address-list';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProfileSettingsPage() {
  const { data: profile, isLoading } = usePatientProfile();

  if (isLoading || !profile) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile photo</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfilePhotoUpload profile={profile} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact details</CardTitle>
          <CardDescription>Used for appointment confirmations and login.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{profile.email ?? 'No email added'}</p>
                {profile.email && (
                  <Badge variant={profile.isEmailVerified ? 'secondary' : 'outline'}>
                    {profile.isEmailVerified ? 'Verified' : 'Unverified'}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-xs">Email</p>
            </div>
            <ChangeEmailDialog currentEmail={profile.email} />
          </div>
          <div className="flex items-center justify-between gap-3 border-t pt-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{profile.phone ?? 'No mobile added'}</p>
                {profile.phone && (
                  <Badge variant={profile.isMobileVerified ? 'secondary' : 'outline'}>
                    {profile.isMobileVerified ? 'Verified' : 'Unverified'}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-xs">Mobile number</p>
            </div>
            <ChangeMobileDialog currentPhone={profile.phone} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personal &amp; medical details</CardTitle>
          <CardDescription>Shared with your doctors during consultations.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileInfoForm profile={profile} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Addresses</CardTitle>
          <CardDescription>Manage your saved addresses.</CardDescription>
        </CardHeader>
        <CardContent>
          <AddressList profile={profile} />
        </CardContent>
      </Card>
    </div>
  );
}
