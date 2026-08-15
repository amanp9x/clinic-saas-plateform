'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ClinicStaffSummaryDto,
  PaginatedResult,
  StaffInvitationDto,
  StaffInviteAcceptInput,
  StaffInviteInput,
  StaffPermissionsUpdateInput,
  StaffRoleUpdateInput,
} from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const STAFF_KEY = ['clinic', 'staff'] as const;
const INVITATIONS_KEY = ['clinic', 'staff', 'invitations'] as const;

export function useClinicStaff(clinicId: string | undefined, q?: string) {
  return useQuery({
    queryKey: [...STAFF_KEY, clinicId ?? null, q ?? null],
    queryFn: () =>
      apiFetch<{ staff: PaginatedResult<ClinicStaffSummaryDto> }>(
        `/api/v1/clinic/staff?clinicId=${clinicId}${q ? `&q=${encodeURIComponent(q)}` : ''}&limit=100`,
      ),
    select: (data) => data.staff,
    enabled: Boolean(clinicId),
  });
}

export function useClinicStaffMember(clinicId: string | undefined, staffMemberId: string | undefined) {
  return useQuery({
    queryKey: [...STAFF_KEY, clinicId ?? null, staffMemberId ?? null],
    queryFn: () => apiFetch<{ staffMember: ClinicStaffSummaryDto }>(`/api/v1/clinic/staff/${staffMemberId}?clinicId=${clinicId}`),
    select: (data) => data.staffMember,
    enabled: Boolean(clinicId && staffMemberId),
  });
}

function useInvalidateStaff() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: STAFF_KEY });
}

export function useUpdateStaffRole(clinicId: string | undefined) {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: ({ staffMemberId, input }: { staffMemberId: string; input: StaffRoleUpdateInput }) =>
      apiFetch<{ staffMember: ClinicStaffSummaryDto }>(`/api/v1/clinic/staff/${staffMemberId}/role?clinicId=${clinicId}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateStaffPermissions(clinicId: string | undefined) {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: ({ staffMemberId, input }: { staffMemberId: string; input: StaffPermissionsUpdateInput }) =>
      apiFetch<{ staffMember: ClinicStaffSummaryDto }>(`/api/v1/clinic/staff/${staffMemberId}/permissions?clinicId=${clinicId}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: invalidate,
  });
}

export function useSetStaffActive(clinicId: string | undefined) {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: ({ staffMemberId, active }: { staffMemberId: string; active: boolean }) =>
      apiFetch<{ staffMember: ClinicStaffSummaryDto }>(`/api/v1/clinic/staff/${staffMemberId}/${active ? 'activate' : 'deactivate'}?clinicId=${clinicId}`, {
        method: 'POST',
      }),
    onSuccess: invalidate,
  });
}

export function useRevokeStaffAccess(clinicId: string | undefined) {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (staffMemberId: string) => apiFetch<null>(`/api/v1/clinic/staff/${staffMemberId}?clinicId=${clinicId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useClinicStaffInvitations(clinicId: string | undefined) {
  return useQuery({
    queryKey: [...INVITATIONS_KEY, clinicId ?? null],
    queryFn: () => apiFetch<{ invitations: StaffInvitationDto[] }>(`/api/v1/clinic/staff/invitations?clinicId=${clinicId}`),
    select: (data) => data.invitations,
    enabled: Boolean(clinicId),
  });
}

export function useInviteStaff(clinicId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<StaffInviteInput, 'clinicId'>) =>
      apiFetch<{ invitation: StaffInvitationDto }>('/api/v1/clinic/staff/invitations', { method: 'POST', body: { clinicId, ...input } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVITATIONS_KEY }),
  });
}

export function useRevokeInvitation(clinicId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      apiFetch<{ invitation: StaffInvitationDto }>(`/api/v1/clinic/staff/invitations/${invitationId}?clinicId=${clinicId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVITATIONS_KEY }),
  });
}

export function useAcceptStaffInvitation() {
  return useMutation({
    mutationFn: (input: StaffInviteAcceptInput) =>
      apiFetch<{ staffMember: ClinicStaffSummaryDto }>('/api/v1/clinic/staff/invitations/accept', { method: 'POST', body: input }),
  });
}
