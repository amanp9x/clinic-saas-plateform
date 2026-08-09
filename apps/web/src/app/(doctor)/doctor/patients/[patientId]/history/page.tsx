'use client';

import { useParams } from 'next/navigation';
import { usePatientMedicalHistory } from '@/hooks/doctor/use-doctor-patient';
import { AppointmentStatusBadge } from '@/components/patient/appointment-status-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/marketing/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate, formatDateTime } from '@/lib/format';

export default function PatientMedicalHistoryPage() {
  const params = useParams<{ patientId: string }>();
  const { data: history, isLoading } = usePatientMedicalHistory(params.patientId);

  if (isLoading || !history) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">{history.profile.fullName} — Medical History</h1>
        <p className="text-muted-foreground text-sm">Full cross-visit history for continuity of care.</p>
      </div>

      <Tabs defaultValue="appointments">
        <TabsList>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
          <TabsTrigger value="reports">Lab Reports</TabsTrigger>
          <TabsTrigger value="vitals">Vitals</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
        </TabsList>

        <TabsContent value="appointments" className="space-y-3 pt-4">
          {history.appointments.length === 0 ? (
            <EmptyState title="No appointment history" />
          ) : (
            history.appointments.map((appt) => (
              <Card key={appt.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-medium">{appt.doctorName}</p>
                    <p className="text-muted-foreground text-sm">
                      {appt.clinicName} · {formatDateTime(appt.scheduledAt)}
                    </p>
                  </div>
                  <AppointmentStatusBadge status={appt.status} />
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="prescriptions" className="space-y-3 pt-4">
          {history.prescriptions.length === 0 ? (
            <EmptyState title="No prescriptions on file" />
          ) : (
            history.prescriptions.map((rx) => (
              <Card key={rx.id}>
                <CardContent className="space-y-2 py-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{rx.doctorName}</p>
                    <p className="text-muted-foreground text-sm">{formatDate(rx.issuedAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {rx.medications.map((m, i) => (
                      <Badge key={i} variant="outline">
                        {m.name} — {m.dosage}
                      </Badge>
                    ))}
                  </div>
                  {rx.notes && <p className="text-muted-foreground text-sm">{rx.notes}</p>}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-3 pt-4">
          {history.labReports.length === 0 ? (
            <EmptyState title="No lab reports on file" />
          ) : (
            history.labReports.map((report) => (
              <Card key={report.id}>
                <CardContent className="flex items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-medium">{report.testName}</p>
                    <p className="text-muted-foreground text-sm">{report.labName ?? 'Lab not specified'}</p>
                  </div>
                  <Badge variant={report.status === 'READY' ? 'secondary' : 'outline'}>
                    {report.status === 'READY' ? 'Ready' : 'Pending'}
                  </Badge>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="vitals" className="space-y-3 pt-4">
          {history.vitalRecords.length === 0 ? (
            <EmptyState title="No vitals recorded" />
          ) : (
            history.vitalRecords.map((v) => (
              <Card key={v.id}>
                <CardContent className="space-y-1 py-3 text-sm">
                  <p className="text-muted-foreground">{formatDateTime(v.recordedAt)}</p>
                  <p>
                    {v.heightCm != null && `Height: ${v.heightCm}cm  `}
                    {v.weightKg != null && `Weight: ${v.weightKg}kg  `}
                    {v.bloodPressureSystolic != null && `BP: ${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}  `}
                    {v.heartRateBpm != null && `HR: ${v.heartRateBpm}bpm  `}
                    {v.temperatureCelsius != null && `Temp: ${v.temperatureCelsius}°C`}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="records" className="space-y-3 pt-4">
          {history.medicalRecords.length === 0 ? (
            <EmptyState title="No additional records" />
          ) : (
            history.medicalRecords.map((record) => (
              <Card key={record.id}>
                <CardContent className="space-y-1 py-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{record.title}</p>
                    <p className="text-muted-foreground text-sm">{formatDate(record.recordDate)}</p>
                  </div>
                  {record.description && <p className="text-muted-foreground text-sm">{record.description}</p>}
                  {record.doctorName && <p className="text-muted-foreground text-xs">By {record.doctorName}</p>}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
