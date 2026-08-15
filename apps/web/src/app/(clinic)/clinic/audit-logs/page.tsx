'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelectedClinic } from '@/hooks/clinic/use-selected-clinic';
import { useClinicAuditLog } from '@/hooks/clinic/use-clinic-audit';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { formatDateTime } from '@/lib/format';

function AuditLogsContent() {
  const router = useRouter();
  const { clinics, clinicId, isLoading: clinicsLoading } = useSelectedClinic();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const { data, isLoading } = useClinicAuditLog(clinicId, { from: from || undefined, to: to || undefined, action: action || undefined, entityType: entityType || undefined });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Audit Logs</h1>
          <p className="text-muted-foreground text-sm">Every clinic-management change, scoped strictly to this clinic.</p>
        </div>
        {clinics.length > 1 && (
          <Select value={clinicId} onValueChange={(value) => value && router.push(`/clinic/audit-logs?clinicId=${value}`)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select a clinic" />
            </SelectTrigger>
            <SelectContent>
              {clinics.map((c) => (
                <SelectItem key={c.clinicId} value={c.clinicId}>
                  {c.clinicName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {clinicsLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !clinicId ? (
        <EmptyState title="No clinic associated" description="You are not assigned to any clinic yet." />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="from">From</Label>
              <input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">To</Label>
              <input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="action">Action contains</Label>
              <Input id="action" value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. doctor_associated" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entityType">Entity type</Label>
              <Input id="entityType" value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="e.g. ClinicDoctor" />
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (data?.items.length ?? 0) === 0 ? (
            <EmptyState title="No audit events" description="No matching audit log entries for this filter." />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data!.items.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-muted-foreground text-xs">{formatDateTime(e.createdAt)}</TableCell>
                        <TableCell>{e.actorName ?? 'System'}</TableCell>
                        <TableCell className="font-medium">{e.action}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {e.entityType}
                          {e.entityId ? ` · ${e.entityId.slice(0, 8)}…` : ''}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClinicAuditLogsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AuditLogsContent />
    </Suspense>
  );
}
