'use client';

import Link from 'next/link';
import {
  CalendarCheck2,
  CalendarClock,
  ClipboardList,
  Clock,
  IndianRupee,
  ListChecks,
  Star,
  Users,
} from 'lucide-react';
import { useDoctorDashboard } from '@/hooks/doctor/use-dashboard';
import { useAuth } from '@/hooks/use-auth';
import { StatCard, StatCardSkeleton } from '@/components/patient/stat-card';
import { DoctorStatusBadge } from '@/components/doctor/doctor-status-badge';
import { EmptyState } from '@/components/marketing/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatFee } from '@/lib/format';

export default function DoctorDashboardPage() {
  const { user } = useAuth();
  const { data: summary, isLoading } = useDoctorDashboard();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">
          Welcome back{user?.email ? `, Dr. ${user.email.split('@')[0]}` : ''}
        </h1>
        <p className="text-muted-foreground text-sm">Here&apos;s today&apos;s snapshot across your clinics.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard icon={CalendarClock} label="Today's Appointments" value={summary?.todayAppointmentsCount ?? 0} href="/doctor/appointments/today" />
            <StatCard icon={CalendarCheck2} label="Upcoming Appointments" value={summary?.upcomingAppointmentsCount ?? 0} href="/doctor/appointments/upcoming" />
            <StatCard icon={ListChecks} label="Completed Consultations" value={summary?.completedConsultationsCount ?? 0} href="/doctor/appointments/past" />
            <StatCard icon={ClipboardList} label="Pending Consultations" value={summary?.pendingConsultationsCount ?? 0} href="/doctor/appointments/today" />
            <StatCard icon={Users} label="Today's Patients" value={summary?.todayPatientsCount ?? 0} href="/doctor/appointments/today" />
            <StatCard icon={Users} label="Waiting Patients" value={summary?.waitingPatientsCount ?? 0} href="/doctor/queue" />
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4" />
              Avg. Consultation Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-2xl font-semibold">
                {summary?.averageConsultationMinutes != null ? `${summary.averageConsultationMinutes} min` : '—'}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IndianRupee className="size-4" />
              Today&apos;s Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-semibold">{formatFee(summary?.todaysEarnings ?? '0')}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="size-4" />
              Rating
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-2xl font-semibold">
                {summary?.ratingAverage != null ? summary.ratingAverage.toFixed(1) : '—'}
                <span className="text-muted-foreground ml-1 text-sm font-normal">
                  ({summary?.ratingCount ?? 0} reviews)
                </span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clinic Status</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : summary && summary.clinicStatuses.length > 0 ? (
            <div className="space-y-3">
              {summary.clinicStatuses.map((clinic) => (
                <div
                  key={clinic.clinicId}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{clinic.clinicName}</p>
                      <DoctorStatusBadge status={clinic.status} />
                    </div>
                    <p className="text-muted-foreground text-sm">
                      Queue: {clinic.queueStatus === 'ACTIVE' ? 'Active' : clinic.queueStatus === 'PAUSED' ? 'Paused' : 'Closed'}
                      {' · '}
                      Current token: {clinic.currentTokenNumber ?? '—'}
                      {' · '}
                      Waiting: {clinic.waitingCount}
                      {clinic.delayMinutes ? ` · Delay: ${clinic.delayMinutes} min` : ''}
                    </p>
                  </div>
                  <Button size="sm" render={<Link href={`/doctor/queue?clinicId=${clinic.clinicId}`} />}>
                    Open Queue
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No active clinics" description="Associate with a clinic to start managing your queue." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button render={<Link href="/doctor/appointments/today" />}>Today&apos;s Appointments</Button>
          <Button variant="outline" render={<Link href="/doctor/queue" />}>Live Queue</Button>
          <Button variant="outline" render={<Link href="/doctor/schedule" />}>Manage Schedule</Button>
          <Button variant="outline" render={<Link href="/doctor/earnings" />}>View Earnings</Button>
        </CardContent>
      </Card>
    </div>
  );
}
