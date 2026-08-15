'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { ClinicResourceStatus, ClinicResourceType } from '@clinic/shared';
import { useSelectedClinic } from '@/hooks/clinic/use-selected-clinic';
import { useClinicResources, useCreateResource, useDeleteResource, useUpdateResource } from '@/hooks/clinic/use-clinic-resources';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { ApiError } from '@/lib/api-client';

const RESOURCE_TYPES: ClinicResourceType[] = ['CONSULTATION_ROOM', 'PROCEDURE_ROOM', 'OTHER'];
const RESOURCE_STATUSES: ClinicResourceStatus[] = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'INACTIVE'];
const STATUS_VARIANT: Record<ClinicResourceStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  AVAILABLE: 'default',
  OCCUPIED: 'secondary',
  MAINTENANCE: 'destructive',
  INACTIVE: 'outline',
};

function AddResourceDialog({ clinicId }: { clinicId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<ClinicResourceType>('CONSULTATION_ROOM');
  const [code, setCode] = useState('');
  const [floor, setFloor] = useState('');
  const [capacity, setCapacity] = useState('');
  const create = useCreateResource(clinicId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button>Add Resource</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add resource</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resource-name">Name</Label>
            <Input id="resource-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => v && setType(v as ClinicResourceType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="resource-code">Code</Label>
              <Input id="resource-code" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resource-floor">Floor</Label>
              <Input id="resource-floor" value={floor} onChange={(e) => setFloor(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resource-capacity">Capacity</Label>
              <Input id="resource-capacity" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || create.isPending}
            onClick={() =>
              create.mutate(
                { name, type, code: code || undefined, floor: floor || undefined, capacity: capacity ? Number(capacity) : undefined },
                {
                  onSuccess: () => {
                    toast.success('Resource created');
                    setOpen(false);
                    setName('');
                  },
                  onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not create resource'),
                },
              )
            }
          >
            {create.isPending ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResourcesContent() {
  const router = useRouter();
  const { clinics, clinicId, isLoading: clinicsLoading } = useSelectedClinic();
  const { data: resources, isLoading } = useClinicResources(clinicId);
  const updateResource = useUpdateResource(clinicId);
  const deleteResource = useDeleteResource(clinicId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Resources</h1>
          <p className="text-muted-foreground text-sm">Consultation rooms, procedure rooms, and other clinic resources.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {clinics.length > 1 && (
            <Select value={clinicId} onValueChange={(value) => value && router.push(`/clinic/resources?clinicId=${value}`)}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Clinic" />
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
          {clinicId && <AddResourceDialog clinicId={clinicId} />}
        </div>
      </div>

      {clinicsLoading || isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !clinicId ? (
        <EmptyState title="No clinic associated" description="You are not assigned to any clinic yet." />
      ) : (resources?.length ?? 0) === 0 ? (
        <EmptyState title="No resources yet" description="Add consultation rooms or other clinic resources." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Floor</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources!.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.type.replace('_', ' ')}</TableCell>
                    <TableCell>{r.code ?? '—'}</TableCell>
                    <TableCell>{r.floor ?? '—'}</TableCell>
                    <TableCell>{r.capacity ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Select
                        value={r.status}
                        onValueChange={(status) =>
                          status &&
                          updateResource.mutate(
                            { id: r.id, input: { status: status as ClinicResourceStatus } },
                            { onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update status') },
                          )
                        }
                      >
                        <SelectTrigger className="ml-auto h-8 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RESOURCE_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          deleteResource.mutate(r.id, {
                            onSuccess: () => toast.success('Resource deleted'),
                            onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not delete resource'),
                          })
                        }
                      >
                        Delete
                      </Button>
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

export default function ClinicResourcesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ResourcesContent />
    </Suspense>
  );
}
