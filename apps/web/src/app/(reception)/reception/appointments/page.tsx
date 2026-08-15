'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ReceptionAppointmentTab } from '@clinic/shared';
import { useSelectedClinic } from '@/hooks/reception/use-selected-clinic';
import { useReceptionDoctorStatuses } from '@/hooks/reception/use-reception-doctors';
import { useReceptionAppointments } from '@/hooks/reception/use-reception-appointments';
import { AppointmentTable } from '@/components/reception/appointment-table';
import { AddAppointmentDialog } from '@/components/reception/add-appointment-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';

const TABS: { value: ReceptionAppointmentTab; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'all', label: 'All' },
];

function AppointmentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clinics, clinicId, isLoading: clinicsLoading } = useSelectedClinic();
  const { data: doctors } = useReceptionDoctorStatuses(clinicId);
  const [tab, setTab] = useState<ReceptionAppointmentTab>((searchParams.get('tab') as ReceptionAppointmentTab) ?? 'today');
  const doctorId = searchParams.get('doctorId') ?? undefined;

  const { data, isLoading } = useReceptionAppointments(clinicId, tab, doctorId);

  function updateClinic(value: string | null) {
    if (!value) return;
    router.push(`/reception/appointments?clinicId=${value}`);
  }

  function updateDoctor(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === 'all') params.delete('doctorId');
    else params.set('doctorId', value);
    router.push(`/reception/appointments?${params.toString()}`);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Appointments</h1>
          <p className="text-muted-foreground text-sm">Check in patients and review the day&apos;s schedule.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {clinicId && (
            <AddAppointmentDialog clinicId={clinicId} trigger={<Button size="sm">Add Appointment</Button>} />
          )}
          {clinics.length > 1 && (
            <Select value={clinicId} onValueChange={updateClinic}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Clinic" />
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
          <Select value={doctorId ?? 'all'} onValueChange={updateDoctor}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All doctors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All doctors</SelectItem>
              {(doctors ?? []).map((d) => (
                <SelectItem key={d.doctorId} value={d.doctorId}>
                  {d.doctorName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <Button key={t.value} variant={tab === t.value ? 'default' : 'outline'} size="sm" onClick={() => setTab(t.value)}>
            {t.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent>
          {clinicsLoading || isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !clinicId ? (
            <EmptyState title="No clinic associated" description="You are not assigned to any clinic yet." />
          ) : (
            <AppointmentTable appointments={data?.items ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ReceptionAppointmentsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AppointmentsContent />
    </Suspense>
  );
}
