'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Gender, updateProfileSchema, type PatientProfileDto, type UpdateProfileInput } from '@clinic/shared';
import { useUpdateProfile } from '@/hooks/patient/use-patient-profile';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormFieldError } from '@/components/auth/form-field-error';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function toCsv(items: string[]): string {
  return items.join(', ');
}

function fromCsv(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export function ProfileInfoForm({ profile }: { profile: PatientProfileDto }) {
  const updateProfile = useUpdateProfile();
  const [allergiesText, setAllergiesText] = useState(toCsv(profile.allergies));
  const [conditionsText, setConditionsText] = useState(toCsv(profile.medicalConditions));

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      fullName: profile.fullName,
      dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : '',
      gender: profile.gender ?? undefined,
      bloodGroup: profile.bloodGroup ?? '',
      allergies: profile.allergies,
      medicalConditions: profile.medicalConditions,
      emergencyName: profile.emergencyName ?? '',
      emergencyPhone: profile.emergencyPhone ?? '',
    },
  });

  const onSubmit = handleSubmit((data) => {
    updateProfile.mutate(
      { ...data, allergies: fromCsv(allergiesText), medicalConditions: fromCsv(conditionsText) },
      {
        onSuccess: () => toast.success('Profile updated'),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update profile'),
      },
    );
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" autoComplete="name" {...register('fullName')} />
        <FormFieldError message={errors.fullName?.message} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth">Date of birth</Label>
          <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} />
          <FormFieldError message={errors.dateOfBirth?.message} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gender">Gender</Label>
          <Controller
            control={control}
            name="gender"
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger id="gender" className="w-full">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(Gender).map((value) => (
                    <SelectItem key={value} value={value}>
                      {value.charAt(0) + value.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bloodGroup">Blood group</Label>
          <Controller
            control={control}
            name="bloodGroup"
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger id="bloodGroup" className="w-full">
                  <SelectValue placeholder="Select blood group" />
                </SelectTrigger>
                <SelectContent>
                  {BLOOD_GROUPS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FormFieldError message={errors.bloodGroup?.message} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="emergencyPhone">Emergency contact number</Label>
          <Input id="emergencyPhone" type="tel" placeholder="+919876543210" {...register('emergencyPhone')} />
          <FormFieldError message={errors.emergencyPhone?.message} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="emergencyName">Emergency contact name</Label>
        <Input id="emergencyName" {...register('emergencyName')} />
        <FormFieldError message={errors.emergencyName?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="allergies">Allergies</Label>
        <Input
          id="allergies"
          placeholder="Penicillin, Peanuts"
          value={allergiesText}
          onChange={(e) => setAllergiesText(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">Separate multiple allergies with commas.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="medicalConditions">Medical conditions</Label>
        <Input
          id="medicalConditions"
          placeholder="Diabetes, Hypertension"
          value={conditionsText}
          onChange={(e) => setConditionsText(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">Separate multiple conditions with commas.</p>
      </div>

      <Button type="submit" disabled={updateProfile.isPending}>
        {updateProfile.isPending ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}
