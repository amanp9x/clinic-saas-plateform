'use client';

import { Pill } from 'lucide-react';
import { usePrescriptions } from '@/hooks/patient/use-medical-records';
import { EmptyState } from '@/components/marketing/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';

export default function PrescriptionsPage() {
  const { data: prescriptions, isLoading } = usePrescriptions();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!prescriptions || prescriptions.length === 0) {
    return (
      <EmptyState
        icon={Pill}
        title="No prescriptions yet"
        description="Prescriptions issued by your doctors will appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      {prescriptions.map((prescription) => (
        <Card key={prescription.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">{prescription.doctorName}</CardTitle>
              <span className="text-muted-foreground text-xs">{formatDate(prescription.issuedAt)}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {prescription.medications.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Medicine</th>
                      <th className="px-3 py-2 text-left font-medium">Dosage</th>
                      <th className="px-3 py-2 text-left font-medium">Frequency</th>
                      <th className="px-3 py-2 text-left font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {prescription.medications.map((med, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-medium">{med.name}</td>
                        <td className="px-3 py-2">{med.dosage}</td>
                        <td className="px-3 py-2">{med.frequency}</td>
                        <td className="px-3 py-2">{med.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {prescription.notes && <p className="text-muted-foreground text-sm">{prescription.notes}</p>}
            {prescription.fileUrl && (
              <a
                href={prescription.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary text-sm font-medium hover:underline"
              >
                Download prescription
              </a>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
