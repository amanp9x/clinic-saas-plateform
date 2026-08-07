import { BedDouble, MapPin, Phone } from 'lucide-react';
import type { HospitalSummary } from '@clinic/shared';
import { Card, CardContent } from '@/components/ui/card';

export function HospitalCard({ hospital }: { hospital: HospitalSummary }) {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-3">
        <div>
          <p className="font-semibold">{hospital.name}</p>
          {hospital.description && (
            <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
              {hospital.description}
            </p>
          )}
        </div>

        <div className="text-muted-foreground mt-auto space-y-1.5 border-t pt-3 text-sm">
          {(hospital.addressLine1 || hospital.city) && (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              <span>
                {[hospital.addressLine1, hospital.city, hospital.state].filter(Boolean).join(', ')}
              </span>
            </div>
          )}
          {hospital.phone && (
            <div className="flex items-center gap-2">
              <Phone className="size-4 shrink-0" />
              <span>{hospital.phone}</span>
            </div>
          )}
          {hospital.bedCount !== null && (
            <div className="flex items-center gap-2">
              <BedDouble className="size-4 shrink-0" />
              <span>{hospital.bedCount} beds</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
