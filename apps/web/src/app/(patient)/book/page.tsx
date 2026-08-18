'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import type { AppointmentType, AvailableSlotDto, ConsultationType } from '@clinic/shared';
import {
  useCreateAppointment,
  useHoldSlot,
  useReleaseHold,
  useSlotAvailability,
  useSlotAvailabilityLive,
} from '@/hooks/patient/use-appointment-booking';
import { DateStrip } from '@/components/booking/date-strip';
import { SlotGrid } from '@/components/booking/slot-grid';
import { JoinWaitlistDialog } from '@/components/patient/join-waitlist-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { ApiError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';

const HOLD_SECONDS = 5 * 60;

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function BookContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const doctorId = searchParams.get('doctorId') ?? undefined;
  const clinicId = searchParams.get('clinicId') ?? undefined;
  const doctorNameParam = searchParams.get('doctorName') ?? undefined;

  const [date, setDate] = useState(todayIso());
  const [consultationType, setConsultationType] = useState<ConsultationType>('IN_CLINIC');
  const [appointmentType, setAppointmentType] = useState<AppointmentType>('NEW_CONSULTATION');
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlotDto | null>(null);
  const [hold, setHold] = useState<{ id: string; expiresAt: string } | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(HOLD_SECONDS);

  const availability = useSlotAvailability(doctorId, clinicId, date, consultationType);
  useSlotAvailabilityLive(doctorId, clinicId, date);
  const holdSlot = useHoldSlot();
  const releaseHold = useReleaseHold();
  const createAppointment = useCreateAppointment();

  useEffect(() => {
    if (!hold) return;
    const tick = () => {
      const secondsLeft = Math.max(0, Math.round((new Date(hold.expiresAt).getTime() - Date.now()) / 1000));
      setRemainingSeconds(secondsLeft);
      if (secondsLeft === 0) {
        setHold(null);
        setSelectedSlot(null);
        toast.error('Your slot hold expired. Please pick a slot again.');
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [hold]);

  if (!doctorId || !clinicId) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          title="Choose a doctor to book"
          description="Start from a doctor's profile and select 'Book Appointment' to begin."
        />
        <div className="mt-4 text-center">
          <Link href="/doctors" className="text-primary text-sm font-medium hover:underline">
            Browse doctors
          </Link>
        </div>
      </div>
    );
  }

  function selectSlot(slot: AvailableSlotDto) {
    if (!doctorId || !clinicId) return;
    holdSlot.mutate(
      { doctorId, clinicId, scheduledAt: slot.startAt, consultationType: slot.consultationType },
      {
        onSuccess: (result) => {
          setSelectedSlot(slot);
          setHold({ id: result.hold.id, expiresAt: result.hold.expiresAt });
        },
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : 'Could not hold this slot');
          availability.refetch();
        },
      },
    );
  }

  function changeSlot() {
    if (hold) releaseHold.mutate(hold.id);
    setHold(null);
    setSelectedSlot(null);
  }

  function confirm() {
    if (!hold || !selectedSlot) return;
    createAppointment.mutate(
      { holdId: hold.id, appointmentType, reasonForVisit: reasonForVisit.trim() || undefined },
      {
        onSuccess: (result) => {
          toast.success(`Appointment booked — ${result.appointment.bookingReference}`);
          router.push(`/appointments/${result.appointment.id}`);
        },
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : 'Could not book this appointment');
          setHold(null);
          setSelectedSlot(null);
          availability.refetch();
        },
      },
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-medium"
      >
        <ArrowLeft className="size-4" />
        Back
      </button>

      <div>
        <h1 className="font-heading text-2xl font-semibold">
          Book with {availability.data?.doctor.displayName ?? doctorNameParam ?? 'doctor'}
        </h1>
        <p className="text-muted-foreground text-sm">{availability.data?.clinic.name ?? ''}</p>
      </div>

      {!hold && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Consultation type</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={consultationType === 'IN_CLINIC' ? 'default' : 'outline'}
                onClick={() => setConsultationType('IN_CLINIC')}
              >
                In-clinic
              </Button>
              <Button
                type="button"
                size="sm"
                variant={consultationType === 'ONLINE' ? 'default' : 'outline'}
                onClick={() => setConsultationType('ONLINE')}
              >
                Online
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select a date</CardTitle>
            </CardHeader>
            <CardContent>
              <DateStrip selectedDate={date} onSelect={setDate} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Available slots</CardTitle>
            </CardHeader>
            <CardContent>
              {availability.isError ? (
                <EmptyState
                  title="Could not load availability"
                  description={
                    availability.error instanceof ApiError
                      ? availability.error.message
                      : 'This doctor may not offer that consultation type at this clinic.'
                  }
                />
              ) : (
                <SlotGrid
                  slots={availability.data?.slots ?? []}
                  closedReason={availability.data?.closedReason ?? null}
                  isLoading={availability.isLoading}
                  onSelect={selectSlot}
                />
              )}
              {!availability.isLoading && !availability.isError && (availability.data?.slots.length ?? 0) === 0 && !availability.data?.closedReason && (
                <div className="mt-4 text-center">
                  <JoinWaitlistDialog
                    doctorId={doctorId}
                    clinicId={clinicId}
                    doctorName={availability.data?.doctor.displayName ?? doctorNameParam ?? 'this doctor'}
                    targetDate={date}
                    consultationType={consultationType}
                    trigger={<Button type="button" variant="outline">Join waitlist for this date</Button>}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {hold && selectedSlot && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review &amp; confirm</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">{formatDateTime(selectedSlot.startAt)}</p>
              <p className="text-muted-foreground text-xs">
                {consultationType === 'ONLINE' ? 'Online consultation' : 'In-clinic visit'} · {selectedSlot.durationMinutes} min
                {selectedSlot.feeRupees !== null ? ` · ₹${selectedSlot.feeRupees.toLocaleString('en-IN')}` : ''}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">Hold expires in {remainingSeconds}s</p>
            </div>

            <div className="space-y-2">
              <Label>Visit type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={appointmentType === 'NEW_CONSULTATION' ? 'default' : 'outline'}
                  onClick={() => setAppointmentType('NEW_CONSULTATION')}
                >
                  New consultation
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={appointmentType === 'FOLLOW_UP' ? 'default' : 'outline'}
                  onClick={() => setAppointmentType('FOLLOW_UP')}
                >
                  Follow-up
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason for visit (optional)</Label>
              <Textarea id="reason" rows={3} value={reasonForVisit} onChange={(e) => setReasonForVisit(e.target.value)} />
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={changeSlot}>
                Change slot
              </Button>
              <Button type="button" className="flex-1" onClick={confirm} disabled={createAppointment.isPending}>
                {createAppointment.isPending ? 'Booking…' : 'Confirm booking'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl space-y-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <BookContent />
    </Suspense>
  );
}
