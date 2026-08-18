'use client';

import { ClipboardList } from 'lucide-react';
import { useDoctorFollowUps } from '@/hooks/doctor/use-doctor-follow-ups';
import { EmptyState } from '@/components/marketing/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';

export default function DoctorFollowUpsPage() {
  const { data, isLoading } = useDoctorFollowUps();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Follow-ups</h1>
        <p className="text-muted-foreground text-sm">Patients you recommended a follow-up visit for.</p>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : data.items.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No follow-ups due" description="Follow-ups you recommend during a consultation will show up here." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Clinic</TableHead>
                  <TableHead>Follow-up date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((row) => (
                  <TableRow key={row.consultationId}>
                    <TableCell>{row.patientName}</TableCell>
                    <TableCell>{row.clinicName}</TableCell>
                    <TableCell>{formatDate(row.followUpDate)}</TableCell>
                    <TableCell>
                      <Badge variant={row.isOverdue ? 'destructive' : 'secondary'}>{row.isOverdue ? 'Overdue' : 'Upcoming'}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
