'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, Save, User } from 'lucide-react';
import type { ConsultationDto, DoctorAppointmentDetailDto } from '@clinic/shared';
import { useDoctorAppointmentDetail } from '@/hooks/doctor/use-doctor-appointments';
import { useCompleteConsultation, useConsultation, useSaveConsultation } from '@/hooks/doctor/use-consultation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api-client';
import { initials } from '@/lib/format';

export default function ConsultationWorkspacePage() {
  const params = useParams<{ appointmentId: string }>();
  const { data: appointment, isLoading: appointmentLoading } = useDoctorAppointmentDetail(params.appointmentId);
  const { data: consultation, isLoading: consultationLoading } = useConsultation(params.appointmentId);

  if (appointmentLoading || consultationLoading || !appointment) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-muted-foreground text-sm">
          This consultation hasn&apos;t been started yet.{' '}
          <Link href={`/doctor/appointments/${params.appointmentId}`} className="text-primary underline">
            Go to the appointment
          </Link>{' '}
          to start it.
        </p>
      </div>
    );
  }

  return <ConsultationForm appointmentId={params.appointmentId} appointment={appointment} consultation={consultation} />;
}

function ConsultationForm({
  appointmentId,
  appointment,
  consultation,
}: {
  appointmentId: string;
  appointment: DoctorAppointmentDetailDto;
  consultation: ConsultationDto;
}) {
  const router = useRouter();
  const saveConsultation = useSaveConsultation(appointmentId);
  const completeConsultation = useCompleteConsultation(appointmentId);

  const [chiefComplaint, setChiefComplaint] = useState(consultation.chiefComplaint ?? '');
  const [symptoms, setSymptoms] = useState(consultation.symptoms.join(', '));
  const [diagnosis, setDiagnosis] = useState(consultation.diagnosis ?? '');
  const [doctorNotes, setDoctorNotes] = useState(consultation.doctorNotes ?? '');
  const [treatmentPlan, setTreatmentPlan] = useState(consultation.treatmentPlan ?? '');
  const [followUpDate, setFollowUpDate] = useState(consultation.followUpDate ? consultation.followUpDate.slice(0, 10) : '');
  const [vitals, setVitals] = useState({
    heightCm: consultation.vitals.heightCm?.toString() ?? '',
    weightKg: consultation.vitals.weightKg?.toString() ?? '',
    temperatureC: consultation.vitals.temperatureC?.toString() ?? '',
    bloodPressureSystolic: consultation.vitals.bloodPressureSystolic?.toString() ?? '',
    bloodPressureDiastolic: consultation.vitals.bloodPressureDiastolic?.toString() ?? '',
    pulseRate: consultation.vitals.pulseRate?.toString() ?? '',
    respiratoryRate: consultation.vitals.respiratoryRate?.toString() ?? '',
    spo2: consultation.vitals.spo2?.toString() ?? '',
  });

  const isCompleted = consultation.status === 'COMPLETED';

  function toNum(value: string): number | null | undefined {
    if (value.trim() === '') return null;
    const n = Number(value);
    return Number.isNaN(n) ? undefined : n;
  }

  function handleSave() {
    saveConsultation.mutate(
      {
        chiefComplaint,
        symptoms: symptoms
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        diagnosis,
        doctorNotes,
        treatmentPlan,
        followUpDate: followUpDate || null,
        vitals: {
          heightCm: toNum(vitals.heightCm),
          weightKg: toNum(vitals.weightKg),
          temperatureC: toNum(vitals.temperatureC),
          bloodPressureSystolic: toNum(vitals.bloodPressureSystolic),
          bloodPressureDiastolic: toNum(vitals.bloodPressureDiastolic),
          pulseRate: toNum(vitals.pulseRate),
          respiratoryRate: toNum(vitals.respiratoryRate),
          spo2: toNum(vitals.spo2),
        },
      },
      {
        onSuccess: () => toast.success('Consultation saved'),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not save consultation'),
      },
    );
  }

  function handleComplete() {
    completeConsultation.mutate(undefined, {
      onSuccess: () => {
        toast.success('Consultation completed');
        router.push(`/doctor/prescriptions/new?appointmentId=${appointmentId}&patientId=${appointment.patientId}`);
      },
      onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not complete consultation'),
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">Consultation Workspace</h1>
        <Badge variant={isCompleted ? 'secondary' : 'default'}>{consultation.status.replace('_', ' ')}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-4" />
            Patient
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarFallback>{initials(appointment.patientName)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{appointment.patientName}</p>
            <p className="text-muted-foreground text-sm">
              {appointment.patientAge != null ? `${appointment.patientAge} yrs` : ''}
              {appointment.patientGender ? ` · ${appointment.patientGender}` : ''}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chief Complaint & Symptoms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="chiefComplaint">Chief complaint</Label>
            <Textarea id="chiefComplaint" value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} disabled={isCompleted} rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="symptoms">Symptoms (comma separated)</Label>
            <Input id="symptoms" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} disabled={isCompleted} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vitals</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="heightCm">Height (cm)</Label>
            <Input id="heightCm" type="number" value={vitals.heightCm} onChange={(e) => setVitals((v) => ({ ...v, heightCm: e.target.value }))} disabled={isCompleted} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weightKg">Weight (kg)</Label>
            <Input id="weightKg" type="number" value={vitals.weightKg} onChange={(e) => setVitals((v) => ({ ...v, weightKg: e.target.value }))} disabled={isCompleted} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="temperatureC">Temperature (°C)</Label>
            <Input id="temperatureC" type="number" step="0.1" value={vitals.temperatureC} onChange={(e) => setVitals((v) => ({ ...v, temperatureC: e.target.value }))} disabled={isCompleted} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bpSystolic">BP Systolic</Label>
            <Input id="bpSystolic" type="number" value={vitals.bloodPressureSystolic} onChange={(e) => setVitals((v) => ({ ...v, bloodPressureSystolic: e.target.value }))} disabled={isCompleted} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bpDiastolic">BP Diastolic</Label>
            <Input id="bpDiastolic" type="number" value={vitals.bloodPressureDiastolic} onChange={(e) => setVitals((v) => ({ ...v, bloodPressureDiastolic: e.target.value }))} disabled={isCompleted} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pulseRate">Pulse (bpm)</Label>
            <Input id="pulseRate" type="number" value={vitals.pulseRate} onChange={(e) => setVitals((v) => ({ ...v, pulseRate: e.target.value }))} disabled={isCompleted} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="respiratoryRate">Respiratory rate</Label>
            <Input id="respiratoryRate" type="number" value={vitals.respiratoryRate} onChange={(e) => setVitals((v) => ({ ...v, respiratoryRate: e.target.value }))} disabled={isCompleted} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spo2">SpO2 (%)</Label>
            <Input id="spo2" type="number" value={vitals.spo2} onChange={(e) => setVitals((v) => ({ ...v, spo2: e.target.value }))} disabled={isCompleted} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Diagnosis & Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="diagnosis">Diagnosis</Label>
            <Textarea id="diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} disabled={isCompleted} rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doctorNotes">Doctor notes</Label>
            <Textarea id="doctorNotes" value={doctorNotes} onChange={(e) => setDoctorNotes(e.target.value)} disabled={isCompleted} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="treatmentPlan">Treatment plan</Label>
            <Textarea id="treatmentPlan" value={treatmentPlan} onChange={(e) => setTreatmentPlan(e.target.value)} disabled={isCompleted} rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="followUpDate">Follow-up date</Label>
            <Input id="followUpDate" type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} disabled={isCompleted} />
          </div>
        </CardContent>
      </Card>

      {!isCompleted && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={handleSave} disabled={saveConsultation.isPending}>
            <Save className="size-4" />
            {saveConsultation.isPending ? 'Saving…' : 'Save Draft'}
          </Button>
          <Button onClick={handleComplete} disabled={completeConsultation.isPending}>
            <CheckCircle2 className="size-4" />
            {completeConsultation.isPending ? 'Completing…' : 'Complete Consultation'}
          </Button>
        </div>
      )}
    </div>
  );
}
