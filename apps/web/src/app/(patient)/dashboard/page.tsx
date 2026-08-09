'use client';

import Link from 'next/link';
import {
  Bell,
  CalendarCheck2,
  CalendarClock,
  FileText,
  FlaskConical,
  Pill,
  Radio,
} from 'lucide-react';
import { useDashboardSummary } from '@/hooks/patient/use-dashboard';
import { useAuth } from '@/hooks/use-auth';
import { AppointmentCard } from '@/components/patient/appointment-card';
import { StatCard, StatCardSkeleton } from '@/components/patient/stat-card';
import { EmptyState } from '@/components/marketing/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: summary, isLoading } = useDashboardSummary();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">
          Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}
        </h1>
        <p className="text-muted-foreground text-sm">Here&apos;s an overview of your health activity.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4" />
              Upcoming Appointment
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : summary?.upcomingAppointment ? (
              <AppointmentCard
                appointment={summary.upcomingAppointment}
                actions={
                  <Button size="sm" variant="outline" render={<Link href={`/appointments/${summary.upcomingAppointment.id}`} />}>
                    View Details
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={CalendarClock}
                title="No upcoming appointments"
                description="You don't have any appointments scheduled yet."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck2 className="size-4" />
              Today&apos;s Appointment
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : summary?.todayAppointment ? (
              <AppointmentCard
                appointment={summary.todayAppointment}
                actions={
                  <>
                    <Button size="sm" render={<Link href={`/queue/${summary.todayAppointment.id}`} />}>
                      Join Queue
                    </Button>
                    <Button size="sm" variant="outline" render={<Link href={`/appointments/${summary.todayAppointment.id}`} />}>
                      View Details
                    </Button>
                  </>
                }
              />
            ) : (
              <EmptyState
                icon={CalendarCheck2}
                title="Nothing scheduled today"
                description="You have no appointments for today."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="size-4" />
            Live Queue Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : summary?.todayAppointment ? (
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-sm text-muted-foreground">
                Track your live position in {summary.todayAppointment.doctorName}&apos;s queue at{' '}
                {summary.todayAppointment.clinicName}.
              </p>
              <Button size="sm" render={<Link href={`/queue/${summary.todayAppointment.id}`} />}>
                View Live Queue
              </Button>
            </div>
          ) : (
            <EmptyState
              icon={Radio}
              title="No active queue"
              description="Queue status appears here once you have an appointment scheduled for today."
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              icon={FileText}
              label="Medical Records"
              value={summary?.medicalRecordsCount ?? 0}
              href="/medical-records/history"
            />
            <StatCard
              icon={Pill}
              label="Prescriptions"
              value={summary?.prescriptionsCount ?? 0}
              href="/medical-records/prescriptions"
            />
            <StatCard
              icon={FlaskConical}
              label="Lab Reports"
              value={summary?.labReportsReadyCount ?? 0}
              hint={summary?.labReportsPendingCount ? `${summary.labReportsPendingCount} pending` : undefined}
              href="/medical-records/reports"
            />
            <StatCard
              icon={Bell}
              label="Notifications"
              value={summary?.unreadNotificationsCount ?? 0}
              hint="Unread"
              href="/notifications"
            />
          </>
        )}
      </div>
    </div>
  );
}
