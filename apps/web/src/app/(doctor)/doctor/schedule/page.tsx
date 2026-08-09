'use client';

import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { useDoctorClinics, useUpdateClinicAssociation } from '@/hooks/doctor/use-doctor-clinics';
import { useDoctorSchedule } from '@/hooks/doctor/use-doctor-schedule';
import { useDeleteLeave, useDoctorLeaves } from '@/hooks/doctor/use-doctor-leaves';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/marketing/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ScheduleSlotDialog } from '@/components/doctor/schedule-slot-dialog';
import { ScheduleWeekGrid } from '@/components/doctor/schedule-week-grid';
import { LeaveDialog } from '@/components/doctor/leave-dialog';
import { ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/format';

export default function DoctorSchedulePage() {
  const { data: clinics, isLoading: clinicsLoading } = useDoctorClinics();
  const { data: slots, isLoading: slotsLoading } = useDoctorSchedule();
  const { data: leaves, isLoading: leavesLoading } = useDoctorLeaves();
  const updateClinic = useUpdateClinicAssociation();
  const deleteLeave = useDeleteLeave();

  const activeClinics = (clinics ?? []).filter((c) => c.isActive);
  const isLoading = clinicsLoading || slotsLoading;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Schedule</h1>
        <p className="text-muted-foreground text-sm">Configure your weekly availability, per-clinic settings, and leave dates.</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : activeClinics.length === 0 ? (
        <EmptyState title="No clinics associated" description="Once you're associated with a clinic, you can set your schedule here." />
      ) : (
        activeClinics.map((clinic) => (
          <Card key={clinic.clinicId}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{clinic.clinicName}</CardTitle>
              <ScheduleSlotDialog
                clinicId={clinic.clinicId}
                trigger={
                  <Button size="sm" variant="outline">
                    <Plus className="size-4" />
                    Add session
                  </Button>
                }
              />
            </CardHeader>
            <CardContent className="space-y-4">
              <ScheduleWeekGrid slots={(slots ?? []).filter((s) => s.clinicId === clinic.clinicId)} />

              <div className="flex flex-wrap items-center gap-4 border-t pt-4 text-sm">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={clinic.isAcceptingAppointments}
                    onCheckedChange={(checked) =>
                      updateClinic.mutate(
                        { clinicId: clinic.clinicId, isAcceptingAppointments: Boolean(checked) },
                        {
                          onSuccess: () => toast.success('Clinic settings updated'),
                          onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update settings'),
                        },
                      )
                    }
                  />
                  Accepting appointments
                </label>
                {clinic.canOverrideDelay && <Badge variant="secondary">Delay override authorized</Badge>}
                <span className="text-muted-foreground">
                  Effective fee: {clinic.effectiveConsultationFee ? `₹${clinic.effectiveConsultationFee}` : 'Not set'}
                </span>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Leave & Holiday Dates</CardTitle>
          <LeaveDialog
            clinics={activeClinics}
            trigger={
              <Button size="sm" variant="outline">
                <Plus className="size-4" />
                Add leave
              </Button>
            }
          />
        </CardHeader>
        <CardContent>
          {leavesLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : !leaves || leaves.length === 0 ? (
            <EmptyState title="No leave dates set" />
          ) : (
            <div className="space-y-2">
              {leaves.map((leave) => (
                <div key={leave.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={leave.type === 'HOLIDAY' ? 'secondary' : 'outline'}>{leave.type}</Badge>
                      <span className="font-medium">
                        {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      {leave.clinicName ?? 'All clinics'}
                      {leave.reason ? ` · ${leave.reason}` : ''}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      deleteLeave.mutate(leave.id, {
                        onSuccess: () => toast.success('Leave removed'),
                        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not remove leave'),
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
