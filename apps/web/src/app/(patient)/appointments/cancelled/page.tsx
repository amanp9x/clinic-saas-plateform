import type { Metadata } from 'next';
import { AppointmentsTabNav } from '@/components/patient/appointments-tab-nav';
import { AppointmentList } from '@/components/patient/appointment-list';

export const metadata: Metadata = { title: 'Cancelled Appointments' };

export default function CancelledAppointmentsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Appointments</h1>
        <p className="text-muted-foreground text-sm">View and manage your appointments.</p>
      </div>
      <AppointmentsTabNav />
      <AppointmentList tab="cancelled" />
    </div>
  );
}
