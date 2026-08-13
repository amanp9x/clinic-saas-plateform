'use client';

import { useSearchParams } from 'next/navigation';
import { useReceptionClinics } from './use-reception-clinics';

/** Resolves the active clinic for the current page: `?clinicId=` if present and valid for this
 * staff member, otherwise their first clinic. Every reception page shares this so switching
 * clinics via the query param behaves consistently. */
export function useSelectedClinic() {
  const searchParams = useSearchParams();
  const { data: clinics, isLoading } = useReceptionClinics();
  const requested = searchParams.get('clinicId');
  const valid = requested && clinics?.some((c) => c.clinicId === requested) ? requested : undefined;
  const clinicId = valid ?? clinics?.[0]?.clinicId;

  return { clinics: clinics ?? [], clinicId, isLoading };
}
