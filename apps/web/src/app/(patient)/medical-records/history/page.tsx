'use client';

import { FileText, Stethoscope } from 'lucide-react';
import { useMedicalHistory } from '@/hooks/patient/use-medical-records';
import { EmptyState } from '@/components/marketing/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';

const RECORD_TYPE_LABELS: Record<string, string> = {
  CONSULTATION_NOTE: 'Consultation Note',
  DIAGNOSIS: 'Diagnosis',
  SURGERY: 'Surgery',
  HOSPITALIZATION: 'Hospitalization',
  OTHER: 'Other',
};

export default function MedicalHistoryPage() {
  const { data: records, isLoading } = useMedicalHistory();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!records || records.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No medical history yet"
        description="Diagnoses, surgeries, and consultation notes from your visits will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {records.map((record) => (
        <Card key={record.id}>
          <CardContent className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{record.title}</p>
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                {RECORD_TYPE_LABELS[record.recordType] ?? record.recordType}
              </span>
            </div>
            {record.description && (
              <p className="text-muted-foreground text-sm">{record.description}</p>
            )}
            <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
              <span>{formatDate(record.recordDate)}</span>
              {record.doctorName && (
                <span className="flex items-center gap-1">
                  <Stethoscope className="size-3" />
                  {record.doctorName}
                </span>
              )}
              {record.attachmentUrl && (
                <a
                  href={record.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary font-medium hover:underline"
                >
                  View attachment
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
