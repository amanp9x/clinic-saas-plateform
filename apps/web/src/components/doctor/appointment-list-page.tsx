'use client';

import type { DoctorAppointmentTab } from '@clinic/shared';
import { useDoctorAppointments } from '@/hooks/doctor/use-doctor-appointments';
import { AppointmentsTabNav } from './appointments-tab-nav';
import { AppointmentListTable } from './appointment-list-table';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const TITLES: Record<DoctorAppointmentTab, string> = {
  today: "Today's Appointments",
  upcoming: 'Upcoming Appointments',
  past: 'Past Appointments',
  cancelled: 'Cancelled Appointments',
  'no-show': 'No-show Appointments',
};

export function AppointmentListPage({ tab }: { tab: DoctorAppointmentTab }) {
  const { data, isLoading } = useDoctorAppointments(tab);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">{TITLES[tab]}</h1>
        <p className="text-muted-foreground text-sm">Manage your appointments and patient consultations.</p>
      </div>
      <AppointmentsTabNav />
      <Card>
        <CardContent>
          {isLoading ? <Skeleton className="h-64 w-full" /> : <AppointmentListTable appointments={data?.items ?? []} />}
        </CardContent>
      </Card>
    </div>
  );
}
