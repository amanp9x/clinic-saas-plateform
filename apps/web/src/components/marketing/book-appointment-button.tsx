'use client';

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/** Booking isn't built yet (deliberately, per the current phase). This is an honest
 * "not yet available" affordance rather than a dead link or a fake booking flow. */
export function BookAppointmentButton({ doctorName }: { doctorName: string }) {
  return (
    <Button
      size="lg"
      className="w-full"
      onClick={() =>
        toast.info('Online booking is launching soon', {
          description: `We'll let you know the moment you can book ${doctorName} online.`,
        })
      }
    >
      Book Appointment
    </Button>
  );
}
