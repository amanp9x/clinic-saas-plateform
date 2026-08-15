'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useSelectedClinic } from '@/hooks/clinic/use-selected-clinic';
import { useClinicDepartments } from '@/hooks/clinic/use-clinic-departments';
import { useClinicServices, useCreateService, useDeleteService, useUpdateService } from '@/hooks/clinic/use-clinic-services';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { ApiError } from '@/lib/api-client';

function CreateServiceDialog({ clinicId }: { clinicId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [duration, setDuration] = useState('15');
  const [price, setPrice] = useState('0');
  const [taxApplicable, setTaxApplicable] = useState(false);
  const { data: departments } = useClinicDepartments(clinicId);
  const create = useCreateService(clinicId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button>Add Service</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add service</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="service-name">Name</Label>
            <Input id="service-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="service-description">Description</Label>
            <Textarea id="service-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Department</Label>
            <Select value={departmentId ?? 'none'} onValueChange={(v) => setDepartmentId(v === 'none' ? null : (v ?? null))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No department</SelectItem>
                {(departments ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="service-duration">Duration (min)</Label>
              <Input id="service-duration" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-price">Price (₹)</Label>
              <Input id="service-price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={taxApplicable} onChange={(e) => setTaxApplicable(e.target.checked)} />
            Tax applicable
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || create.isPending}
            onClick={() =>
              create.mutate(
                { name, description: description || undefined, departmentId, durationMinutes: Number(duration), price: Number(price), taxApplicable },
                {
                  onSuccess: () => {
                    toast.success('Service created');
                    setOpen(false);
                    setName('');
                  },
                  onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not create service'),
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

function ServicesContent() {
  const router = useRouter();
  const { clinics, clinicId, isLoading: clinicsLoading } = useSelectedClinic();
  const { data: services, isLoading } = useClinicServices(clinicId);
  const updateService = useUpdateService(clinicId);
  const deleteService = useDeleteService(clinicId);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Services</h1>
          <p className="text-muted-foreground text-sm">Bookable services offered at this clinic.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {clinics.length > 1 && (
            <Select value={clinicId} onValueChange={(value) => value && router.push(`/clinic/services?clinicId=${value}`)}>
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
          {clinicId && <CreateServiceDialog clinicId={clinicId} />}
        </div>
      </div>

      {clinicsLoading || isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !clinicId ? (
        <EmptyState title="No clinic associated" description="You are not assigned to any clinic yet." />
      ) : (services?.length ?? 0) === 0 ? (
        <EmptyState title="No services yet" description="Add your first service to start offering it to patients." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services!.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.departmentName ?? '—'}</TableCell>
                    <TableCell>{s.durationMinutes} min</TableCell>
                    <TableCell>
                      ₹{s.price}
                      {s.taxApplicable ? ' + tax' : ''}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.isActive ? 'default' : 'secondary'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateService.mutate(
                            { id: s.id, input: { isActive: !s.isActive } },
                            { onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update service') },
                          )
                        }
                      >
                        {s.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          deleteService.mutate(s.id, {
                            onSuccess: () => toast.success('Service deleted'),
                            onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not delete service'),
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

export default function ClinicServicesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ServicesContent />
    </Suspense>
  );
}
