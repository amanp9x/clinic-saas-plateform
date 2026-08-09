'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, HeartPulse, Phone, User } from 'lucide-react';
import { useDoctorPatientProfile } from '@/hooks/doctor/use-doctor-patient';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { initials } from '@/lib/format';

export default function DoctorPatientProfilePage() {
  const params = useParams<{ patientId: string }>();
  const { data: patient, isLoading } = useDoctorPatientProfile(params.patientId);

  if (isLoading || !patient) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">Patient Profile</h1>
        <Button variant="outline" render={<Link href={`/doctor/patients/${patient.id}/history`} />}>
          View medical history
        </Button>
      </div>

      <Card>
        <CardContent className="flex items-center gap-4">
          <Avatar className="size-16">
            <AvatarFallback>{initials(patient.fullName)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold">{patient.fullName}</p>
            <p className="text-muted-foreground text-sm">
              {patient.age != null ? `${patient.age} yrs` : 'Age not on file'}
              {patient.gender ? ` · ${patient.gender}` : ''}
              {patient.bloodGroup ? ` · ${patient.bloodGroup}` : ''}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="size-4" />
            Contact
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Phone: </span>
            {patient.phone ?? 'Not shared'}
          </p>
          <p>
            <span className="text-muted-foreground">Email: </span>
            {patient.email ?? 'Not shared'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4" />
            Allergies
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {patient.allergies.length > 0 ? (
            patient.allergies.map((a) => (
              <Badge key={a} variant="destructive">
                {a}
              </Badge>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">No known allergies on file.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HeartPulse className="size-4" />
            Medical Conditions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {patient.medicalConditions.length > 0 ? (
            patient.medicalConditions.map((c) => (
              <Badge key={c} variant="secondary">
                {c}
              </Badge>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">No conditions on file.</p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" render={<Link href="/doctor/appointments/today" />}>
          <User className="size-4" />
          Back to appointments
        </Button>
      </div>
    </div>
  );
}
