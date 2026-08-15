'use client';

import Link from 'next/link';
import { CLINIC_PERMISSIONS } from '@clinic/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const GROUPS: { title: string; keys: (keyof typeof CLINIC_PERMISSIONS)[] }[] = [
  { title: 'Clinic', keys: ['CLINIC_VIEW', 'CLINIC_UPDATE', 'CLINIC_DOCUMENTS_MANAGE'] },
  { title: 'Doctors', keys: ['DOCTOR_VIEW', 'DOCTOR_MANAGE', 'DOCTOR_SCHEDULE_MANAGE'] },
  { title: 'Staff', keys: ['STAFF_VIEW', 'STAFF_MANAGE', 'STAFF_PERMISSIONS_MANAGE'] },
  { title: 'Departments & Services', keys: ['DEPARTMENT_VIEW', 'DEPARTMENT_MANAGE', 'SERVICE_VIEW', 'SERVICE_MANAGE'] },
  { title: 'Schedule & Holidays', keys: ['SCHEDULE_VIEW', 'SCHEDULE_MANAGE', 'HOLIDAY_VIEW', 'HOLIDAY_MANAGE'] },
  { title: 'Resources', keys: ['RESOURCE_VIEW', 'RESOURCE_MANAGE'] },
  { title: 'Queue (Reception)', keys: ['QUEUE_VIEW', 'QUEUE_MANAGE', 'QUEUE_DELAY_UPDATE', 'QUEUE_PAUSE', 'QUEUE_RESUME', 'QUEUE_PRIORITY_UPDATE'] },
  { title: 'Patients & Appointments (Reception)', keys: ['PATIENT_CHECKIN', 'PATIENT_WALKIN_CREATE', 'APPOINTMENT_MANAGE', 'DOCTOR_STATUS_UPDATE'] },
  { title: 'Reports', keys: ['REPORTS_VIEW'] },
];

export default function ClinicPermissionsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Permissions</h1>
        <p className="text-muted-foreground text-sm">
          Every permission key available for staff. CLINIC_ADMIN bypasses all of these automatically. Grant them to individual staff
          members from their <Link href="/clinic/staff" className="underline">staff profile</Link>.
        </p>
      </div>

      {GROUPS.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle className="text-base">{group.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {group.keys.map((key) => (
              <Badge key={key} variant="outline">
                {CLINIC_PERMISSIONS[key]}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" render={<Link href="/clinic/staff" />}>
        Go to Staff Management
      </Button>
    </div>
  );
}
