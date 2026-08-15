'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useSelectedClinic } from '@/hooks/clinic/use-selected-clinic';
import { useClinicHolidays, useCreateHoliday, useDeleteHoliday } from '@/hooks/clinic/use-clinic-holidays';
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
import { formatDate } from '@/lib/format';

function AddHolidayDialog({ clinicId }: { clinicId: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [isFullDay, setIsFullDay] = useState(true);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('13:00');
  const create = useCreateHoliday(clinicId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button>Add Holiday</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add holiday</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="holiday-date">Date</Label>
            <input id="holiday-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="holiday-name">Name</Label>
            <Input id="holiday-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isFullDay} onChange={(e) => setIsFullDay(e.target.checked)} />
            Full day
          </label>
          {!isFullDay && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start time</Label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm" />
              </div>
              <div className="space-y-2">
                <Label>End time</Label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm" />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!date || !name.trim() || create.isPending}
            onClick={() =>
              create.mutate(
                { date, name, isFullDay, startTime: isFullDay ? undefined : startTime, endTime: isFullDay ? undefined : endTime },
                {
                  onSuccess: () => {
                    toast.success('Holiday added');
                    setOpen(false);
                    setDate('');
                    setName('');
                  },
                  onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not add holiday'),
                },
              )
            }
          >
            {create.isPending ? 'Adding…' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HolidaysContent() {
  const router = useRouter();
  const { clinics, clinicId, isLoading: clinicsLoading } = useSelectedClinic();
  const { data: holidays, isLoading } = useClinicHolidays(clinicId);
  const deleteHoliday = useDeleteHoliday(clinicId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Holidays</h1>
          <p className="text-muted-foreground text-sm">Clinic closures and partial-day exceptions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {clinics.length > 1 && (
            <Select value={clinicId} onValueChange={(value) => value && router.push(`/clinic/holidays?clinicId=${value}`)}>
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
          {clinicId && <AddHolidayDialog clinicId={clinicId} />}
        </div>
      </div>

      {clinicsLoading || isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !clinicId ? (
        <EmptyState title="No clinic associated" description="You are not assigned to any clinic yet." />
      ) : (holidays?.length ?? 0) === 0 ? (
        <EmptyState title="No holidays scheduled" description="Add clinic closures here." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays!.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{formatDate(h.date)}</TableCell>
                    <TableCell className="font-medium">{h.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{h.isFullDay ? 'Full day' : `${h.startTime}–${h.endTime}`}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          deleteHoliday.mutate(h.id, {
                            onSuccess: () => toast.success('Holiday removed'),
                            onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not remove holiday'),
                          })
                        }
                      >
                        Remove
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

export default function ClinicHolidaysPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <HolidaysContent />
    </Suspense>
  );
}
