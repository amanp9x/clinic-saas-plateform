'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  SOCKET_EVENTS,
  type AvailabilityResultDto,
  type BookingConfirmationDto,
  type ConsultationType,
  type SlotHoldDto,
} from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';
import { useQueueSocket } from '@/hooks/use-queue-socket';
import { getQueueSocket } from '@/lib/socket-client';

function availabilityKey(doctorId: string | undefined, clinicId: string | undefined, date: string | undefined) {
  return ['patient', 'availability', doctorId ?? null, clinicId ?? null, date ?? null] as const;
}

export function useSlotAvailability(
  doctorId: string | undefined,
  clinicId: string | undefined,
  date: string | undefined,
  consultationType?: ConsultationType,
) {
  return useQuery({
    queryKey: [...availabilityKey(doctorId, clinicId, date), consultationType ?? null],
    queryFn: () =>
      apiFetch<AvailabilityResultDto>(
        `/api/v1/appointments/availability?doctorId=${doctorId}&clinicId=${clinicId}&date=${date}${
          consultationType ? `&consultationType=${consultationType}` : ''
        }`,
      ),
    enabled: Boolean(doctorId && clinicId && date),
  });
}

/** Refetches the slot grid live as other patients hold/release/book slots for this doctor+clinic. */
export function useSlotAvailabilityLive(doctorId: string | undefined, clinicId: string | undefined, date: string | undefined) {
  const { isConnected } = useQueueSocket(clinicId);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!doctorId || !clinicId || !date) return;
    const socket = getQueueSocket();
    const invalidate = () => queryClient.invalidateQueries({ queryKey: availabilityKey(doctorId, clinicId, date) });

    const events = [
      SOCKET_EVENTS.SLOT.HELD,
      SOCKET_EVENTS.SLOT.RELEASED,
      SOCKET_EVENTS.SLOT.UPDATED,
      SOCKET_EVENTS.APPOINTMENT.CREATED,
      SOCKET_EVENTS.APPOINTMENT.RESCHEDULED,
      SOCKET_EVENTS.APPOINTMENT.CANCELLED,
    ];
    events.forEach((event) => socket.on(event, invalidate));
    return () => {
      events.forEach((event) => socket.off(event, invalidate));
    };
  }, [doctorId, clinicId, date, queryClient]);

  return { isConnected };
}

export function useHoldSlot() {
  return useMutation({
    mutationFn: (input: { doctorId: string; clinicId: string; scheduledAt: string; consultationType: ConsultationType }) =>
      apiFetch<{ hold: SlotHoldDto }>('/api/v1/appointments/hold', { method: 'POST', body: input }),
  });
}

export function useReleaseHold() {
  return useMutation({
    mutationFn: (holdId: string) => apiFetch<null>(`/api/v1/appointments/hold/${holdId}`, { method: 'DELETE' }),
  });
}

function invalidateAfterBookingChange(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['patient', 'appointments'] });
  queryClient.invalidateQueries({ queryKey: ['patient', 'availability'] });
  queryClient.invalidateQueries({ queryKey: ['patient', 'dashboard-summary'] });
  queryClient.invalidateQueries({ queryKey: ['patient', 'notifications'] });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      holdId?: string;
      doctorId?: string;
      clinicId?: string;
      scheduledAt?: string;
      consultationType?: ConsultationType;
      appointmentType?: string;
      reasonForVisit?: string;
    }) => apiFetch<{ appointment: BookingConfirmationDto }>('/api/v1/appointments', { method: 'POST', body: input }),
    onSuccess: () => invalidateAfterBookingChange(queryClient),
  });
}

export function useRescheduleAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; newScheduledAt: string; holdId?: string; reason?: string }) =>
      apiFetch(`/api/v1/appointments/${id}/reschedule`, { method: 'PATCH', body: input }),
    onSuccess: () => invalidateAfterBookingChange(queryClient),
  });
}
