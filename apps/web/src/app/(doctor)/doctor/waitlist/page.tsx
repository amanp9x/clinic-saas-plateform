'use client';

import { Clock } from 'lucide-react';
import { useDoctorWaitlist } from '@/hooks/doctor/use-doctor-waitlist';
import { EmptyState } from '@/components/marketing/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';

export default function DoctorWaitlistPage() {
  const { data, isLoading } = useDoctorWaitlist();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Waitlist</h1>
        <p className="text-muted-foreground text-sm">Patients waiting for an opening with you.</p>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : data.items.length === 0 ? (
        <EmptyState icon={Clock} title="No one waiting" description="When you're fully booked, patients can join your waitlist and you'll see them here." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clinic</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.clinicName}</TableCell>
                    <TableCell>{formatDate(`${entry.targetDate}T00:00:00.000Z`)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{entry.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatDate(entry.createdAt)}</TableCell>
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
