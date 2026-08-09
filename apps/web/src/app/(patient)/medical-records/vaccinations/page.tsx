'use client';

import { Syringe } from 'lucide-react';
import { useVaccinations } from '@/hooks/patient/use-medical-records';
import { EmptyState } from '@/components/marketing/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';

export default function VaccinationsPage() {
  const { data: vaccinations, isLoading } = useVaccinations();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!vaccinations || vaccinations.length === 0) {
    return (
      <EmptyState
        icon={Syringe}
        title="No vaccination records yet"
        description="Vaccinations administered at your clinics will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {vaccinations.map((vaccination) => (
        <Card key={vaccination.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">
                {vaccination.vaccineName}
                {vaccination.doseNumber && (
                  <span className="text-muted-foreground font-normal"> · Dose {vaccination.doseNumber}</span>
                )}
              </p>
              <p className="text-muted-foreground text-sm">
                Administered {formatDate(vaccination.administeredDate)}
                {vaccination.administeredBy ? ` by ${vaccination.administeredBy}` : ''}
              </p>
              {vaccination.notes && <p className="text-muted-foreground text-sm">{vaccination.notes}</p>}
            </div>
            {vaccination.nextDueDate && (
              <div className="text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next due</p>
                <p className="text-sm font-medium">{formatDate(vaccination.nextDueDate)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
