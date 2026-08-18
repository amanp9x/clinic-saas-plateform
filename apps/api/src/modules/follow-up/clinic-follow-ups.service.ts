import { CLINIC_PERMISSIONS, type UserRole } from '@clinic/shared';
import type { ClinicFollowUpsQuery, FollowUpRowDto, PaginatedResult } from '@clinic/shared';
import { followUpRepository } from './follow-up.repository.js';
import { toFollowUpRowDto } from './follow-up.mappers.js';
import { assertClinicPermission } from '../reception/reception.shared.js';

export const clinicFollowUpsService = {
  /** Same QUEUE_VIEW-gated read/APPOINTMENT_MANAGE-gated-manage split as the clinic waitlist
   * screen (Phase 13) — this is a read-only list, no manage action exists here (reception acts by
   * calling the patient and/or booking a follow-up appointment through the normal booking engine,
   * not through a state change on the Consultation row itself). */
  async list(userId: string, role: UserRole, query: ClinicFollowUpsQuery): Promise<PaginatedResult<FollowUpRowDto>> {
    await assertClinicPermission(userId, role, query.clinicId, CLINIC_PERMISSIONS.QUEUE_VIEW);
    const { items, total } = await followUpRepository.listDueForClinic(query.clinicId, {
      doctorId: query.doctorId,
      page: query.page,
      limit: query.limit,
    });
    return {
      items: items.map((row) => toFollowUpRowDto(row)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  },
};
