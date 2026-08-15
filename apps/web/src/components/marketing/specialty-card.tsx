import Link from 'next/link';
import type { SpecializationSummary } from '@clinic/shared';
import { Card, CardContent } from '@/components/ui/card';
import { SpecializationIcon } from '@/lib/specialization-icons';

export function SpecialtyCard({ specialization }: { specialization: SpecializationSummary }) {
  return (
    <Link href={`/specializations/${specialization.slug}`}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="flex flex-col items-center gap-2 text-center">
          <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
            <SpecializationIcon iconName={specialization.iconName} className="size-6" />
          </div>
          <p className="text-sm font-medium">{specialization.name}</p>
          <p className="text-muted-foreground text-xs">
            {specialization.doctorCount} {specialization.doctorCount === 1 ? 'doctor' : 'doctors'}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
