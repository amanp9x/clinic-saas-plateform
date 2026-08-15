'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function BookAppointmentButton({
  doctorId,
  doctorName,
  clinicId,
}: {
  doctorId: string;
  doctorName: string;
  clinicId?: string;
}) {
  const router = useRouter();

  return (
    <Button
      size="lg"
      className="w-full"
      onClick={() => {
        const params = new URLSearchParams({ doctorId, doctorName });
        if (clinicId) params.set('clinicId', clinicId);
        router.push(`/book?${params.toString()}`);
      }}
    >
      Book Appointment
    </Button>
  );
}
