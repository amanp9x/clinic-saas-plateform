'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { ConsultationType } from '@clinic/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAssociateDoctor, useSearchExistingDoctors } from '@/hooks/clinic/use-clinic-doctors';
import { ApiError } from '@/lib/api-client';

const CONSULTATION_TYPES: ConsultationType[] = ['IN_CLINIC', 'ONLINE', 'FOLLOW_UP', 'EMERGENCY'];

export function AssociateDoctorDialog({ clinicId, defaultOpen }: { clinicId: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [query, setQuery] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [consultationTypes, setConsultationTypes] = useState<ConsultationType[]>(['IN_CLINIC']);
  const { data: results } = useSearchExistingDoctors(clinicId, query);
  const associate = useAssociateDoctor(clinicId);

  function toggleType(type: ConsultationType) {
    setConsultationTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  function reset() {
    setQuery('');
    setSelectedDoctorId(null);
    setConsultationTypes(['IN_CLINIC']);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button>Add Doctor</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Associate an existing doctor</DialogTitle>
          <DialogDescription>Search the platform&apos;s doctor directory — no new Doctor account is ever created here.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="doctor-search">Search doctors</Label>
            <Input
              id="doctor-search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedDoctorId(null);
              }}
              placeholder="Search by name"
            />
            {query && (results?.length ?? 0) > 0 && (
              <ul className="max-h-48 divide-y overflow-y-auto rounded-md border">
                {results!.map((d) => (
                  <li key={d.doctorId}>
                    <button
                      type="button"
                      disabled={d.alreadyAssociated}
                      onClick={() => setSelectedDoctorId(d.doctorId)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 ${selectedDoctorId === d.doctorId ? 'bg-primary/10' : ''}`}
                    >
                      {d.doctorName} {d.specializationName ? `· ${d.specializationName}` : ''}
                      {d.alreadyAssociated ? ' (already associated)' : ''}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <Label>Consultation types</Label>
            <div className="flex flex-wrap gap-4">
              {CONSULTATION_TYPES.map((type) => (
                <label key={type} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={consultationTypes.includes(type)} onCheckedChange={() => toggleType(type)} />
                  {type.replace('_', ' ')}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!selectedDoctorId || consultationTypes.length === 0 || associate.isPending}
            onClick={() =>
              associate.mutate(
                { doctorId: selectedDoctorId!, consultationTypes },
                {
                  onSuccess: () => {
                    toast.success('Doctor associated with clinic');
                    setOpen(false);
                    reset();
                  },
                  onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not associate doctor'),
                },
              )
            }
          >
            {associate.isPending ? 'Associating…' : 'Associate Doctor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
