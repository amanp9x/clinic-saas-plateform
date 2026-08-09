'use client';

import { toast } from 'sonner';
import type { DoctorManualStatus } from '@clinic/shared';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDoctorClinics } from '@/hooks/doctor/use-doctor-clinics';
import { useDoctorStatus, useUpdateDoctorStatus } from '@/hooks/doctor/use-doctor-status';
import { ApiError } from '@/lib/api-client';
import { DoctorStatusBadge } from './doctor-status-badge';

const STATUS_OPTIONS: { value: DoctorManualStatus; label: string }[] = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'DELAYED', label: 'Running Late' },
  { value: 'ON_BREAK', label: 'On Break' },
  { value: 'UNAVAILABLE', label: 'Unavailable' },
  { value: 'SESSION_ENDED', label: 'Clinic Closed' },
];

export function DoctorStatusSwitcher() {
  const { data: clinics } = useDoctorClinics();
  const { data: sessions } = useDoctorStatus();
  const updateStatus = useUpdateDoctorStatus();

  const activeClinics = clinics?.filter((c) => c.isActive) ?? [];
  if (activeClinics.length === 0) return null;

  const primary = sessions?.[0];

  const handleChange = (clinicId: string, status: DoctorManualStatus) => {
    updateStatus.mutate(
      { clinicId, status },
      {
        onSuccess: () => toast.success('Status updated'),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update status'),
      },
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="outline" size="sm">
          {primary ? <DoctorStatusBadge status={primary.status} /> : 'Set status'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {activeClinics.map((clinic) => {
          const session = sessions?.find((s) => s.clinicId === clinic.clinicId);
          return (
            <DropdownMenuSub key={clinic.clinicId}>
              <DropdownMenuSubTrigger>{clinic.clinicName}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuLabel>Set status</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={session?.status ?? 'NOT_ARRIVED'}
                  onValueChange={(value) => handleChange(clinic.clinicId, value as DoctorManualStatus)}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
