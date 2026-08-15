'use client';

import { useEffect, useRef, useState } from 'react';
import type { ApiResponse, DoctorQueueStatus } from '@clinic/shared';
import { clientEnv } from '@/lib/env';

const POLL_INTERVAL_MS = 25_000;

/** Public, unauthenticated polling for a doctor's live-queue summary at one clinic. Deliberately
 * a plain REST poll rather than a Socket.IO subscription — the socket auth middleware requires a
 * JWT and anonymous visitors have none; polling avoids widening that surface for this phase. */
export function useDoctorQueueStatus(
  doctorSlug: string,
  clinicId: string,
  initial: DoctorQueueStatus,
): DoctorQueueStatus {
  const [status, setStatus] = useState(initial);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    async function poll() {
      if (document.visibilityState === 'hidden') return;
      try {
        const res = await fetch(
          `${clientEnv.apiUrl}/api/v1/catalog/doctors/${encodeURIComponent(doctorSlug)}/queue?clinicId=${encodeURIComponent(clinicId)}`,
        );
        const json = (await res.json()) as ApiResponse<DoctorQueueStatus>;
        if (mounted.current && json.success) {
          setStatus(json.data);
        }
      } catch {
        // Silently keep the last known status — a transient network hiccup shouldn't flash an error.
      }
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, [doctorSlug, clinicId]);

  return status;
}
