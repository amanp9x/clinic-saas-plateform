'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { DoctorProfileDto } from '@clinic/shared';
import { useDoctorProfile, useRemoveDoctorPhoto, useUpdateDoctorProfile, useUploadDoctorPhoto } from '@/hooks/doctor/use-doctor-profile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api-client';
import { initials } from '@/lib/format';

export default function DoctorProfileSettingsPage() {
  const { data: profile, isLoading } = useDoctorProfile();

  if (isLoading || !profile) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return <DoctorProfileForm profile={profile} />;
}

function DoctorProfileForm({ profile }: { profile: DoctorProfileDto }) {
  const updateProfile = useUpdateDoctorProfile();
  const uploadPhoto = useUploadDoctorPhoto();
  const removePhoto = useRemoveDoctorPhoto();

  const [form, setForm] = useState({
    displayName: profile.displayName,
    bio: profile.bio ?? '',
    qualifications: profile.qualifications ?? '',
    languages: profile.languages.join(', '),
    yearsExperience: profile.yearsExperience?.toString() ?? '',
    consultationFee: profile.consultationFee ?? '',
    onlineConsultation: profile.onlineConsultation,
  });

  function handleSave() {
    updateProfile.mutate(
      {
        displayName: form.displayName,
        bio: form.bio,
        qualifications: form.qualifications,
        languages: form.languages
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean),
        yearsExperience: form.yearsExperience ? Number(form.yearsExperience) : undefined,
        consultationFee: form.consultationFee ? Number(form.consultationFee) : undefined,
        onlineConsultation: form.onlineConsultation,
      },
      {
        onSuccess: () => toast.success('Profile updated'),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update profile'),
      },
    );
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadPhoto.mutate(file, {
      onSuccess: () => toast.success('Photo updated'),
      onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not upload photo'),
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile photo</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="size-16">
            {profile.profileImageUrl && <AvatarImage src={profile.profileImageUrl} alt={profile.displayName} />}
            <AvatarFallback>{initials(profile.displayName)}</AvatarFallback>
          </Avatar>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" render={<label htmlFor="doctor-photo" />}>
              {uploadPhoto.isPending ? 'Uploading…' : 'Upload photo'}
            </Button>
            <input id="doctor-photo" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            {profile.profileImageUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removePhoto.mutate(undefined, { onSuccess: () => toast.success('Photo removed') })}
              >
                Remove
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Professional details</CardTitle>
          <CardDescription>Shown on your public profile and used across the portal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input id="displayName" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qualifications">Qualifications</Label>
            <Input id="qualifications" value={form.qualifications} onChange={(e) => setForm((f) => ({ ...f, qualifications: e.target.value }))} placeholder="e.g. MBBS, MD (Cardiology)" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} rows={3} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="languages">Languages (comma separated)</Label>
              <Input id="languages" value={form.languages} onChange={(e) => setForm((f) => ({ ...f, languages: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yearsExperience">Years of experience</Label>
              <Input id="yearsExperience" type="number" min={0} value={form.yearsExperience} onChange={(e) => setForm((f) => ({ ...f, yearsExperience: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="consultationFee">Default consultation fee (₹)</Label>
            <Input id="consultationFee" type="number" min={0} value={form.consultationFee} onChange={(e) => setForm((f) => ({ ...f, consultationFee: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.onlineConsultation}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, onlineConsultation: Boolean(checked) }))}
            />
            Offer online consultations
          </label>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={updateProfile.isPending}>
            {updateProfile.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
