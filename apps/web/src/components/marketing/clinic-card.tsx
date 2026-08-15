import Link from 'next/link';
import { MapPin, Phone, Stethoscope } from 'lucide-react';
import type { ClinicSummary } from '@clinic/shared';
import { Card, CardContent } from '@/components/ui/card';
import { FavoriteButton } from './favorite-button';

export function ClinicCard({ clinic }: { clinic: ClinicSummary }) {
  return (
    <div className="relative h-full">
      <div className="absolute top-3 right-3 z-10">
        <FavoriteButton type="clinic" id={clinic.id} />
      </div>
      <Link href={`/clinics/${clinic.slug}`} className="block h-full">
        <Card className="h-full transition-shadow hover:shadow-md">
          <CardContent className="flex h-full flex-col gap-3">
            <div>
              <p className="font-semibold">{clinic.name}</p>
              {clinic.description && (
                <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{clinic.description}</p>
              )}
            </div>

            <div className="text-muted-foreground mt-auto space-y-1.5 border-t pt-3 text-sm">
              {(clinic.addressLine1 || clinic.area || clinic.city) && (
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {[clinic.addressLine1, clinic.area, clinic.city, clinic.state].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
              {clinic.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="size-4 shrink-0" />
                  <span>{clinic.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Stethoscope className="size-4 shrink-0" />
                <span>
                  {clinic.doctorCount} {clinic.doctorCount === 1 ? 'doctor' : 'doctors'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
