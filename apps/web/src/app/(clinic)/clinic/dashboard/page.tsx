'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserPlus, Stethoscope, Users, CalendarClock, Layers, ClipboardList, Settings } from 'lucide-react';
import { useSelectedClinic } from '@/hooks/clinic/use-selected-clinic';
import { useClinicDashboard } from '@/hooks/clinic/use-clinic-dashboard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';

const QUICK_ACTIONS = [
  { href: '/clinic/doctors?invite=1', label: 'Add Doctor', icon: Stethoscope },
  { href: '/clinic/staff?invite=1', label: 'Add Staff', icon: UserPlus },
  { href: '/clinic/doctors', label: 'Manage Doctors', icon: Stethoscope },
  { href: '/clinic/staff', label: 'Manage Staff', icon: Users },
  { href: '/clinic/schedule', label: 'Manage Schedule', icon: CalendarClock },
  { href: '/clinic/departments', label: 'Manage Departments', icon: Layers },
  { href: '/clinic/services', label: 'Manage Services', icon: ClipboardList },
  { href: '/clinic/settings', label: 'Clinic Settings', icon: Settings },
];

function DashboardContent() {
  const router = useRouter();
  const { clinics, clinicId, isLoading: clinicsLoading } = useSelectedClinic();
  const { data: summary, isLoading } = useClinicDashboard(clinicId);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Clinic Dashboard</h1>
          <p className="text-muted-foreground text-sm">Real-time overview of your clinic&apos;s operations.</p>
        </div>
        {clinics.length > 1 && (
          <Select value={clinicId} onValueChange={(value) => value && router.push(`/clinic/dashboard?clinicId=${value}`)}>
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
      ) : !clinicId ? (
        <EmptyState title="No clinic associated" description="You are not assigned to any clinic yet." />
      ) : summary ? (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Badge variant={summary.status === 'OPEN' ? 'default' : summary.status === 'TEMPORARILY_CLOSED' ? 'secondary' : 'outline'}>
              Clinic {summary.status.replace('_', ' ')}
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {[
              { label: 'Total Doctors', value: summary.totalDoctors },
              { label: 'Active Doctors', value: summary.activeDoctors },
              { label: 'Total Staff', value: summary.totalStaff },
              { label: "Today's Appointments", value: summary.todayAppointments },
              { label: 'Checked In', value: summary.todayCheckedIn },
              { label: 'Waiting', value: summary.waitingPatients },
              { label: 'Completed', value: summary.completedConsultations },
              { label: 'Cancelled', value: summary.cancelledAppointments },
              { label: 'No-shows', value: summary.noShows },
              { label: "Today's Revenue", value: `₹${summary.todayRevenue}` },
              { label: 'Active Departments', value: summary.activeDepartments },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardHeader>
                  <CardTitle className="text-muted-foreground text-sm">{stat.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {QUICK_ACTIONS.map((action) => (
                <Button key={action.label} variant="outline" render={<Link href={clinicId ? `${action.href}${action.href.includes('?') ? '&' : '?'}clinicId=${clinicId}` : action.href} />}>
                  <action.icon className="size-4" />
                  {action.label}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

export default function ClinicDashboardPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <DashboardContent />
    </Suspense>
  );
}
