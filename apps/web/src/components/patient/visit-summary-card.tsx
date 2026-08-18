'use client';

import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import type { VisitSummaryDto } from '@clinic/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';

const VITALS: { key: keyof NonNullable<VisitSummaryDto['consultation']>['vitals']; label: string; unit: string }[] = [
  { key: 'heightCm', label: 'Height', unit: 'cm' },
  { key: 'weightKg', label: 'Weight', unit: 'kg' },
  { key: 'temperatureC', label: 'Temperature', unit: '°C' },
  { key: 'pulseRate', label: 'Pulse', unit: 'bpm' },
  { key: 'respiratoryRate', label: 'Respiratory rate', unit: '/min' },
  { key: 'spo2', label: 'SpO2', unit: '%' },
];

export function VisitSummaryCard({ summary, isLoading }: { summary: VisitSummaryDto | undefined; isLoading: boolean }) {
  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }
  if (!summary) return null;

  const { consultation, prescription } = summary;
  if (!consultation && !prescription) return null;

  const bloodPressure =
    consultation?.vitals.bloodPressureSystolic && consultation.vitals.bloodPressureDiastolic
      ? `${consultation.vitals.bloodPressureSystolic}/${consultation.vitals.bloodPressureDiastolic} mmHg`
      : null;
  const hasVitals = Boolean(bloodPressure) || VITALS.some((v) => consultation?.vitals[v.key] != null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="size-4" />
          Visit Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {consultation?.chiefComplaint && (
          <div>
            <p className="text-sm font-medium">Chief complaint</p>
            <p className="text-muted-foreground text-sm">{consultation.chiefComplaint}</p>
          </div>
        )}

        {consultation?.diagnosis && (
          <div>
            <p className="text-sm font-medium">Diagnosis</p>
            <p className="text-muted-foreground text-sm">{consultation.diagnosis}</p>
          </div>
        )}

        {hasVitals && (
          <div>
            <p className="mb-2 text-sm font-medium">Vitals</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {bloodPressure && (
                <div>
                  <p className="text-muted-foreground text-xs">Blood pressure</p>
                  <p className="text-sm font-medium">{bloodPressure}</p>
                </div>
              )}
              {VITALS.filter((v) => consultation?.vitals[v.key] != null).map((v) => (
                <div key={v.key}>
                  <p className="text-muted-foreground text-xs">{v.label}</p>
                  <p className="text-sm font-medium">
                    {consultation?.vitals[v.key]} {v.unit}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {consultation?.treatmentPlan && (
          <div>
            <p className="text-sm font-medium">Treatment plan</p>
            <p className="text-muted-foreground text-sm">{consultation.treatmentPlan}</p>
          </div>
        )}

        {consultation?.doctorNotes && (
          <div>
            <p className="text-sm font-medium">Doctor&apos;s notes</p>
            <p className="text-muted-foreground text-sm">{consultation.doctorNotes}</p>
          </div>
        )}

        {prescription && prescription.items.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Prescription</p>
              {prescription.pdfUrl && (
                <Button size="sm" variant="outline" render={<a href={prescription.pdfUrl} target="_blank" rel="noreferrer" />}>
                  Download PDF
                </Button>
              )}
            </div>
            <ul className="space-y-2">
              {prescription.items.map((item) => (
                <li key={item.id} className="rounded-lg border p-2 text-sm">
                  <p className="font-medium">{item.medicineName}</p>
                  <p className="text-muted-foreground text-xs">
                    {[item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ')}
                  </p>
                  {item.instructions && <p className="text-muted-foreground text-xs italic">{item.instructions}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {consultation?.followUpDate && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Follow-up recommended</p>
              <p className="text-muted-foreground text-xs">Around {formatDate(consultation.followUpDate)}</p>
            </div>
            <Button
              size="sm"
              render={
                <Link
                  href={`/book?doctorId=${summary.doctorId}&clinicId=${summary.clinicId}&doctorName=${encodeURIComponent(summary.doctorName)}&date=${consultation.followUpDate.slice(0, 10)}`}
                />
              }
            >
              Book follow-up
            </Button>
          </div>
        )}

        {!consultation?.followUpDate && prescription?.followUpDate && (
          <Badge variant="secondary" className="text-xs">
            Follow-up noted on prescription: {formatDate(prescription.followUpDate)}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
