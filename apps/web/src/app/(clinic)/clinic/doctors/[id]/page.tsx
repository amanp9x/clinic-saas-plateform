'use client';

import { Suspense, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import type { ClinicDoctorDetailDto, ConsultationType, DepartmentDto, Weekday } from '@clinic/shared';
import { useSelectedClinic } from '@/hooks/clinic/use-selected-clinic';
import { useClinicDepartments } from '@/hooks/clinic/use-clinic-departments';
import { useClinicDoctorDetail, useRemoveClinicDoctor, useUpdateClinicDoctor } from '@/hooks/clinic/use-clinic-doctors';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { initials } from '@/lib/format';

const CONSULTATION_TYPES: ConsultationType[] = ['IN_CLINIC', 'ONLINE', 'FOLLOW_UP', 'EMERGENCY'];
const WEEKDAYS: Weekday[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/** Keyed by `doctor.clinicDoctorId` from the parent so React remounts (fresh initial state)
 * whenever the loaded record changes, instead of syncing server data into local state via an effect. */
function DoctorAssociationForm({ clinicId, doctor, departments }: { clinicId: string; doctor: ClinicDoctorDetailDto; departments: DepartmentDto[] }) {
  const router = useRouter();
  const updateDoctor = useUpdateClinicDoctor(clinicId);
  const removeDoctor = useRemoveClinicDoctor(clinicId);

  const [fee, setFee] = useState(doctor.consultationFee ?? '');
  const [duration, setDuration] = useState(doctor.consultationDurationMinutes?.toString() ?? '');
  const [departmentId, setDepartmentId] = useState<string | null>(doctor.departmentId);
  const [consultationTypes, setConsultationTypes] = useState<ConsultationType[]>(doctor.consultationTypes);
  const [availableDays, setAvailableDays] = useState<Weekday[]>(doctor.availableDays);
  const [isAcceptingAppointments, setIsAcceptingAppointments] = useState(doctor.isAcceptingAppointments);
  const [queueEnabled, setQueueEnabled] = useState(doctor.queueEnabled);
  const [removeOpen, setRemoveOpen] = useState(false);

  function toggleType(type: ConsultationType) {
    setConsultationTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }
  function toggleDay(day: Weekday) {
    setAvailableDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function save() {
    updateDoctor.mutate(
      {
        clinicDoctorId: doctor.clinicDoctorId,
        input: {
          consultationFeeOverride: fee ? Number(fee) : null,
          consultationDurationMinutesOverride: duration ? Number(duration) : null,
          departmentId,
          consultationTypes,
          availableDays,
          isAcceptingAppointments,
          queueEnabled,
        },
      },
      {
        onSuccess: () => toast.success('Doctor association updated'),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update association'),
      },
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback>{initials(doctor.doctorName)}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-xl">{doctor.doctorName}</CardTitle>
            <p className="text-muted-foreground text-sm">{doctor.specializationName ?? 'No specialization listed'}</p>
          </div>
          <Badge className="ml-auto">{doctor.status}</Badge>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Association Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fee">Consultation fee override</Label>
              <Input id="fee" type="number" value={fee} onChange={(e) => setFee(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration override (minutes)</Label>
              <Input id="duration" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Department</Label>
            <Select value={departmentId ?? 'none'} onValueChange={(v) => setDepartmentId(v === 'none' ? null : (v ?? null))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No department</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Consultation types</Label>
            <div className="flex flex-wrap gap-4">
              {CONSULTATION_TYPES.map((type) => (
                <label key={type} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={consultationTypes.includes(type)} onCheckedChange={() => toggleType(type)} />
                  {type.replace('_', ' ')}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Available days</Label>
            <div className="flex flex-wrap gap-4">
              {WEEKDAYS.map((day) => (
                <label key={day} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={availableDays.includes(day)} onCheckedChange={() => toggleDay(day)} />
                  {day}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isAcceptingAppointments} onCheckedChange={(v) => setIsAcceptingAppointments(Boolean(v))} />
              Accepting appointments
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={queueEnabled} onCheckedChange={(v) => setQueueEnabled(Boolean(v))} />
              Queue enabled
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={save} disabled={updateDoctor.isPending}>
              {updateDoctor.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
            <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
              <DialogTrigger>
                <Button variant="destructive">Remove Association</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Remove this doctor from the clinic?</DialogTitle>
                  <DialogDescription>This removes their availability and schedule at this clinic. The Doctor account itself is unaffected.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRemoveOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() =>
                      removeDoctor.mutate(doctor.clinicDoctorId, {
                        onSuccess: () => {
                          toast.success('Doctor association removed');
                          router.push(`/clinic/doctors?clinicId=${clinicId}`);
                        },
                        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not remove association'),
                      })
                    }
                    disabled={removeDoctor.isPending}
                  >
                    Remove
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DoctorDetailContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { clinicId: fallbackClinicId } = useSelectedClinic();
  const clinicId = searchParams.get('clinicId') ?? fallbackClinicId;

  const { data: doctor, isLoading } = useClinicDoctorDetail(clinicId, params.id);
  const { data: departments } = useClinicDepartments(clinicId);

  if (isLoading) return <Skeleton className="mx-auto h-96 max-w-2xl" />;
  if (!doctor || !clinicId) return <EmptyState title="Doctor association not found" description="This doctor is not associated with the selected clinic." />;

  return (
    <div className="mx-auto max-w-2xl">
      <DoctorAssociationForm key={doctor.clinicDoctorId} clinicId={clinicId} doctor={doctor} departments={departments ?? []} />
    </div>
  );
}

export default function ClinicDoctorDetailPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-2xl" />}>
      <DoctorDetailContent />
    </Suspense>
  );
}
