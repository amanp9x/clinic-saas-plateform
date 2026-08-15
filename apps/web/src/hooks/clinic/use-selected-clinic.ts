'use client';

import { useSearchParams } from 'next/navigation';
import { useClinicList } from './use-clinic-list';

/** Resolves the active clinic for the current page: `?clinicId=` if present and valid for this
 * admin/staff member, otherwise their first clinic. Mirrors hooks/reception/use-selected-clinic. */
export function useSelectedClinic() {
  const searchParams = useSearchParams();
  const { data: clinics, isLoading } = useClinicList();
  const requested = searchParams.get('clinicId');
  const valid = requested && clinics?.some((c) => c.clinicId === requested) ? requested : undefined;
  const clinicId = valid ?? clinics?.[0]?.clinicId;

  return { clinics: clinics ?? [], clinicId, isLoading };
}
