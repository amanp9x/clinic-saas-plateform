'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useSelectedClinic } from '@/hooks/clinic/use-selected-clinic';
import { useClinicDepartments, useCreateDepartment, useDeleteDepartment, useUpdateDepartment } from '@/hooks/clinic/use-clinic-departments';
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

function CreateDepartmentDialog({ clinicId }: { clinicId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const create = useCreateDepartment(clinicId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button>Add Department</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add department</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dept-name">Name</Label>
            <Input id="dept-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dept-description">Description</Label>
            <Textarea id="dept-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
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
                { name, description: description || undefined, displayOrder: 0 },
                {
                  onSuccess: () => {
                    toast.success('Department created');
                    setOpen(false);
                    setName('');
                    setDescription('');
                  },
                  onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not create department'),
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

function DepartmentsContent() {
  const router = useRouter();
  const { clinics, clinicId, isLoading: clinicsLoading } = useSelectedClinic();
  const { data: departments, isLoading } = useClinicDepartments(clinicId);
  const updateDepartment = useUpdateDepartment(clinicId);
  const deleteDepartment = useDeleteDepartment(clinicId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Departments</h1>
          <p className="text-muted-foreground text-sm">Clinical departments used to organize doctors and services.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {clinics.length > 1 && (
            <Select value={clinicId} onValueChange={(value) => value && router.push(`/clinic/departments?clinicId=${value}`)}>
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
          {clinicId && <CreateDepartmentDialog clinicId={clinicId} />}
        </div>
      </div>

      {clinicsLoading || isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !clinicId ? (
        <EmptyState title="No clinic associated" description="You are not assigned to any clinic yet." />
      ) : (departments?.length ?? 0) === 0 ? (
        <EmptyState title="No departments yet" description="Add your first department to start organizing doctors and services." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Doctors</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments!.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="text-muted-foreground">{d.description ?? '—'}</TableCell>
                    <TableCell>{d.doctorCount}</TableCell>
                    <TableCell>{d.serviceCount}</TableCell>
                    <TableCell>
                      <Badge variant={d.isActive ? 'default' : 'secondary'}>{d.isActive ? 'Active' : 'Inactive'}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateDepartment.mutate(
                            { id: d.id, input: { isActive: !d.isActive } },
                            { onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update department') },
                          )
                        }
                      >
                        {d.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          deleteDepartment.mutate(d.id, {
                            onSuccess: () => toast.success('Department deleted'),
                            onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not delete department'),
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

export default function ClinicDepartmentsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <DepartmentsContent />
    </Suspense>
  );
}
