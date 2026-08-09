'use client';

import { useRef } from 'react';
import { toast } from 'sonner';
import type { PatientProfileDto } from '@clinic/shared';
import { useRemoveProfilePhoto, useUploadProfilePhoto } from '@/hooks/patient/use-patient-profile';
import { ApiError } from '@/lib/api-client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { initials } from '@/lib/format';

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function ProfilePhotoUpload({ profile }: { profile: PatientProfileDto }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadPhoto = useUploadProfilePhoto();
  const removePhoto = useRemoveProfilePhoto();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Please upload a JPEG, PNG, or WEBP image');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error('Image must be smaller than 5MB');
      return;
    }

    uploadPhoto.mutate(file, {
      onSuccess: () => toast.success('Profile photo updated'),
      onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not upload photo'),
    });
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16">
        {profile.profileImageUrl && <AvatarImage src={profile.profileImageUrl} alt={profile.fullName} />}
        <AvatarFallback>{initials(profile.fullName)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={uploadPhoto.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploadPhoto.isPending ? 'Uploading…' : 'Upload photo'}
        </Button>
        {profile.profileImageUrl && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={removePhoto.isPending}
            onClick={() =>
              removePhoto.mutate(undefined, {
                onSuccess: () => toast.success('Profile photo removed'),
                onError: (err) =>
                  toast.error(err instanceof ApiError ? err.message : 'Could not remove photo'),
              })
            }
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
