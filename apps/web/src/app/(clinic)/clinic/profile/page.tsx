'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { ClinicOperatingStatus, ClinicProfileDto } from '@clinic/shared';
import { useSelectedClinic } from '@/hooks/clinic/use-selected-clinic';
import { useClinicProfile, useSubmitClinicVerification, useUpdateClinicProfile, useUpdateClinicStatus } from '@/hooks/clinic/use-clinic-profile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { ApiError } from '@/lib/api-client';

const STATUS_OPTIONS: ClinicOperatingStatus[] = ['OPEN', 'CLOSED', 'TEMPORARILY_CLOSED', 'SUSPENDED'];

function initialFormFrom(clinic: ClinicProfileDto) {
  return {
    name: clinic.name ?? '',
    legalName: clinic.legalName ?? '',
    clinicType: clinic.clinicType ?? '',
    registrationNumber: clinic.registrationNumber ?? '',
    description: clinic.description ?? '',
    email: clinic.email ?? '',
    phone: clinic.phone ?? '',
    alternatePhone: clinic.alternatePhone ?? '',
    website: clinic.website ?? '',
    addressLine1: clinic.addressLine1 ?? '',
    addressLine2: clinic.addressLine2 ?? '',
    city: clinic.city ?? '',
    state: clinic.state ?? '',
    postalCode: clinic.postalCode ?? '',
    establishedYear: clinic.establishedYear?.toString() ?? '',
    languages: clinic.languages.join(', '),
    facilities: clinic.facilities.join(', '),
    accessibilityInfo: clinic.accessibilityInfo ?? '',
    instagramUrl: clinic.instagramUrl ?? '',
    facebookUrl: clinic.facebookUrl ?? '',
  };
}

/** Keyed by `clinic.id` from the parent so React remounts (fresh initial state) whenever the
 * loaded record changes, instead of syncing server data into local state via an effect. */
function ClinicProfileForm({ clinicId, clinic }: { clinicId: string; clinic: ClinicProfileDto }) {
  const updateProfile = useUpdateClinicProfile(clinicId);
  const submitVerification = useSubmitClinicVerification(clinicId);
  const updateStatus = useUpdateClinicStatus(clinicId);

  const [form, setForm] = useState(() => initialFormFrom(clinic));
  const [statusOpen, setStatusOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<ClinicOperatingStatus>(clinic.status);
  const [statusReason, setStatusReason] = useState('');

  function field(key: keyof typeof form) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  function submit() {
    updateProfile.mutate(
      {
        ...form,
        establishedYear: form.establishedYear ? Number(form.establishedYear) : null,
        languages: form.languages ? form.languages.split(',').map((s) => s.trim()).filter(Boolean) : [],
        facilities: form.facilities ? form.facilities.split(',').map((s) => s.trim()).filter(Boolean) : [],
      } as never,
      {
        onSuccess: () => toast.success('Clinic profile updated'),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update profile'),
      },
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Status &amp; Verification</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={clinic.status === 'OPEN' ? 'default' : 'secondary'}>{clinic.status.replace('_', ' ')}</Badge>
            <Badge variant="outline">Verification: {clinic.verificationStatus.replace('_', ' ')}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
            <DialogTrigger>
              <Button variant="outline">Change status</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Change clinic status</DialogTitle>
                <DialogDescription>Temporarily closing the clinic requires a reason.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={nextStatus} onValueChange={(v) => v && setNextStatus(v as ClinicOperatingStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {nextStatus === 'TEMPORARILY_CLOSED' && (
                  <div className="space-y-2">
                    <Label htmlFor="status-reason">Reason (required)</Label>
                    <Textarea id="status-reason" value={statusReason} onChange={(e) => setStatusReason(e.target.value)} rows={2} />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStatusOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    updateStatus.mutate(
                      { status: nextStatus, reason: statusReason || undefined },
                      {
                        onSuccess: () => {
                          toast.success('Clinic status updated');
                          setStatusOpen(false);
                        },
                        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update status'),
                      },
                    )
                  }
                  disabled={updateStatus.isPending}
                >
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {clinic.verificationStatus === 'PENDING' || clinic.verificationStatus === 'REJECTED' ? (
            <Button
              variant="outline"
              onClick={() =>
                submitVerification.mutate(undefined, {
                  onSuccess: () => toast.success('Verification submitted'),
                  onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not submit verification'),
                })
              }
              disabled={submitVerification.isPending}
            >
              Submit for verification
            </Button>
          ) : null}
        </CardContent>
        {(clinic.verificationStatus === 'REJECTED' || clinic.verificationStatus === 'SUSPENDED') && clinic.verificationReviewNotes && (
          <CardContent className="border-t pt-4">
            <p className="text-destructive text-sm font-medium">
              {clinic.verificationStatus === 'REJECTED' ? 'Verification rejected' : 'Verification suspended'}
            </p>
            <p className="text-muted-foreground text-sm">{clinic.verificationReviewNotes}</p>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Clinic name</Label>
            <Input id="name" {...field('name')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legalName">Legal name</Label>
            <Input id="legalName" {...field('legalName')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clinicType">Clinic type</Label>
            <Input id="clinicType" {...field('clinicType')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="registrationNumber">Registration number</Label>
            <Input id="registrationNumber" {...field('registrationNumber')} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...field('description')} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="establishedYear">Established year</Label>
            <Input id="establishedYear" type="number" {...field('establishedYear')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...field('phone')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="alternatePhone">Alternate phone</Label>
            <Input id="alternatePhone" {...field('alternatePhone')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...field('email')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input id="website" {...field('website')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="addressLine1">Address line 1</Label>
            <Input id="addressLine1" {...field('addressLine1')} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="addressLine2">Address line 2</Label>
            <Input id="addressLine2" {...field('addressLine2')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" {...field('city')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input id="state" {...field('state')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postalCode">Postal code</Label>
            <Input id="postalCode" {...field('postalCode')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Additional &amp; Social</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="languages">Languages (comma separated)</Label>
            <Input id="languages" {...field('languages')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="facilities">Facilities (comma separated)</Label>
            <Input id="facilities" {...field('facilities')} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="accessibilityInfo">Accessibility information</Label>
            <Textarea id="accessibilityInfo" {...field('accessibilityInfo')} rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instagramUrl">Instagram</Label>
            <Input id="instagramUrl" {...field('instagramUrl')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="facebookUrl">Facebook</Label>
            <Input id="facebookUrl" {...field('facebookUrl')} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={submit} disabled={updateProfile.isPending}>
        {updateProfile.isPending ? 'Saving…' : 'Save Profile'}
      </Button>
    </div>
  );
}

function ProfileContent() {
  const router = useRouter();
  const { clinics, clinicId, isLoading: clinicsLoading } = useSelectedClinic();
  const { data: clinic, isLoading } = useClinicProfile(clinicId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Clinic Profile</h1>
          <p className="text-muted-foreground text-sm">The source of truth for clinic-level details used across the platform.</p>
        </div>
        {clinics.length > 1 && (
          <Select value={clinicId} onValueChange={(value) => value && router.push(`/clinic/profile?clinicId=${value}`)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select a clinic" />
            </SelectTrigger>
            <SelectContent>
              {clinics.map((c) => (
                <SelectItem key={c.clinicId} value={c.clinicId}>
                  {c.clinicName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {clinicsLoading || isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !clinicId || !clinic ? (
        <EmptyState title="No clinic associated" description="You are not assigned to any clinic yet." />
      ) : (
        <ClinicProfileForm key={clinic.id} clinicId={clinicId} clinic={clinic} />
      )}
    </div>
  );
}

export default function ClinicProfilePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ProfileContent />
    </Suspense>
  );
}
