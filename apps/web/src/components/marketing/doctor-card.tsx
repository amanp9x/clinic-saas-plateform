import Link from 'next/link';
import type { DoctorSummary } from '@clinic/shared';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { RatingStars } from './rating-stars';
import { FavoriteButton } from './favorite-button';
import { formatExperience, formatFee, initials } from '@/lib/format';

export function DoctorCard({ doctor }: { doctor: DoctorSummary }) {
  return (
    <div className="relative h-full">
      <div className="absolute top-3 right-3 z-10">
        <FavoriteButton type="doctor" id={doctor.id} />
      </div>
      <Link href={`/doctors/${doctor.slug}`} className="block h-full">
        <Card className="h-full transition-shadow hover:shadow-md">
          <CardContent className="flex h-full flex-col gap-3">
            <div className="flex items-start gap-3">
              <Avatar className="size-14">
                {doctor.profileImageUrl && (
                  <AvatarImage src={doctor.profileImageUrl} alt={doctor.displayName} />
                )}
                <AvatarFallback>{initials(doctor.displayName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{doctor.displayName}</p>
                <p className="text-muted-foreground truncate text-sm">
                  {doctor.specializationName ?? 'General Practice'}
                </p>
                <RatingStars rating={doctor.ratingAverage} count={doctor.ratingCount} />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {doctor.city && <Badge variant="secondary">{doctor.city}</Badge>}
              {doctor.availableToday && <Badge variant="secondary">Available today</Badge>}
              {doctor.onlineConsultation && <Badge variant="secondary">Online consult</Badge>}
            </div>

            <div className="mt-auto flex items-center justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">
                {formatExperience(doctor.yearsExperience)}
              </span>
              <span className="font-medium">{formatFee(doctor.consultationFee)}</span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
