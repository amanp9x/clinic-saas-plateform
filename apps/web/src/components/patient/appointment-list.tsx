'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarX2 } from 'lucide-react';
import type { AppointmentTab } from '@clinic/shared';
import { useAppointments } from '@/hooks/patient/use-appointments';
import { AppointmentCard } from './appointment-card';
import { CancelAppointmentDialog } from './cancel-appointment-dialog';
import { EmptyState } from '@/components/marketing/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

const CANCELLABLE_STATUSES = new Set(['PENDING', 'CONFIRMED']);

export function AppointmentList({ tab }: { tab: AppointmentTab }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAppointments(tab, page);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        icon={CalendarX2}
        title="No appointments here"
        description="Appointments in this category will show up here once available."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {data.items.map((appointment) => (
          <AppointmentCard
            key={appointment.id}
            appointment={appointment}
            actions={
              <>
                <Button size="sm" variant="outline" render={<Link href={`/appointments/${appointment.id}`} />}>
                  View Details
                </Button>
                {tab === 'today' && (
                  <Button size="sm" render={<Link href={`/queue/${appointment.id}`} />}>
                    Join Queue
                  </Button>
                )}
                {appointment.hasPrescription && (
                  <Button size="sm" variant="outline" render={<Link href="/medical-records/prescriptions" />}>
                    View Prescription
                  </Button>
                )}
                {(tab === 'upcoming' || tab === 'today') && CANCELLABLE_STATUSES.has(appointment.status) && (
                  <CancelAppointmentDialog
                    appointmentId={appointment.id}
                    trigger={
                      <Button size="sm" variant="destructive">
                        Cancel
                      </Button>
                    }
                  />
                )}
              </>
            }
          />
        ))}
      </div>

      {data.totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPage((p) => Math.max(1, p - 1));
                }}
                aria-disabled={page <= 1}
                className={page <= 1 ? 'pointer-events-none opacity-50' : undefined}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="text-muted-foreground px-3 text-sm">
                Page {data.page} of {data.totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPage((p) => Math.min(data.totalPages, p + 1));
                }}
                aria-disabled={page >= data.totalPages}
                className={page >= data.totalPages ? 'pointer-events-none opacity-50' : undefined}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
