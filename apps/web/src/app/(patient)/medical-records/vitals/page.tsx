'use client';

import { Activity } from 'lucide-react';
import { useVitals } from '@/hooks/patient/use-medical-records';
import { EmptyState } from '@/components/marketing/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';

function Vital({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

export default function VitalsPage() {
  const { data: vitals, isLoading } = useVitals();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (!vitals || vitals.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No vitals recorded yet"
        description="Height, weight, blood pressure, and other vitals recorded during your visits will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {vitals.map((vital) => (
        <Card key={vital.id}>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-xs font-medium">{formatDate(vital.recordedAt)}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Vital label="Height" value={vital.heightCm !== null ? `${vital.heightCm} cm` : null} />
              <Vital label="Weight" value={vital.weightKg !== null ? `${vital.weightKg} kg` : null} />
              <Vital
                label="Blood Pressure"
                value={
                  vital.bloodPressureSystolic !== null && vital.bloodPressureDiastolic !== null
                    ? `${vital.bloodPressureSystolic}/${vital.bloodPressureDiastolic} mmHg`
                    : null
                }
              />
              <Vital label="Heart Rate" value={vital.heartRateBpm !== null ? `${vital.heartRateBpm} bpm` : null} />
              <Vital
                label="Temperature"
                value={vital.temperatureCelsius !== null ? `${vital.temperatureCelsius} °C` : null}
              />
              <Vital
                label="Blood Sugar"
                value={vital.bloodSugarMgDl !== null ? `${vital.bloodSugarMgDl} mg/dL` : null}
              />
            </div>
            {vital.notes && <p className="text-muted-foreground text-sm">{vital.notes}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
