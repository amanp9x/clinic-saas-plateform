'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  SOCKET_EVENTS,
  type AvailabilityResultDto,
  type BookingConfirmationDto,
  type ConsultationType,
  type Gender,
} from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';
import { useQueueSocket } from '@/hooks/use-queue-socket';
import { getQueueSocket } from '@/lib/socket-client';

function availabilityKey(doctorId: string | undefined, clinicId: string | undefined, date: string | undefined) {
  return ['reception', 'availability', doctorId ?? null, clinicId ?? null, date ?? null] as const;
}

export function useReceptionSlotAvailability(
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

export function useReceptionSlotAvailabilityLive(doctorId: string | undefined, clinicId: string | undefined, date: string | undefined) {
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

function invalidateAfterBookingChange(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['reception', 'appointments'] });
  queryClient.invalidateQueries({ queryKey: ['reception', 'availability'] });
  queryClient.invalidateQueries({ queryKey: ['reception', 'queue'] });
  queryClient.invalidateQueries({ queryKey: ['reception', 'dashboard'] });
}

export interface ReceptionCreateAppointmentPayload {
  patientId?: string;
  newPatient?: { fullName: string; phone?: string; age?: number; gender?: Gender };
  holdId?: string;
  doctorId?: string;
  clinicId: string;
  scheduledAt?: string;
  consultationType?: ConsultationType;
  appointmentType?: string;
  reasonForVisit?: string;
}

export function useReceptionCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReceptionCreateAppointmentPayload) =>
      apiFetch<{ appointment: BookingConfirmationDto }>('/api/v1/reception/appointments', { method: 'POST', body: input }),
    onSuccess: () => invalidateAfterBookingChange(queryClient),
  });
}

export function useReceptionRescheduleAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, clinicId, ...input }: { id: string; clinicId: string; newScheduledAt: string; holdId?: string; reason?: string }) =>
      apiFetch(`/api/v1/reception/appointments/${id}/reschedule?clinicId=${clinicId}`, { method: 'PATCH', body: input }),
    onSuccess: () => invalidateAfterBookingChange(queryClient),
  });
}

export function useReceptionCancelAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, clinicId, reason }: { id: string; clinicId: string; reason: string }) =>
      apiFetch(`/api/v1/reception/appointments/${id}/cancel?clinicId=${clinicId}`, { method: 'PATCH', body: { reason } }),
    onSuccess: () => invalidateAfterBookingChange(queryClient),
  });
}

export function useReceptionMarkNoShowAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, clinicId, reason }: { id: string; clinicId: string; reason?: string }) =>
      apiFetch(`/api/v1/reception/appointments/${id}/no-show`, { method: 'PATCH', body: { clinicId, reason } }),
    onSuccess: () => invalidateAfterBookingChange(queryClient),
  });
}
