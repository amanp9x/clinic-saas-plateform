'use client';

import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useCreateVaccination } from '@/hooks/doctor/use-doctor-patient';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RecordVaccinationDialog({ patientId, trigger }: { patientId: string; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [vaccineName, setVaccineName] = useState('');
  const [doseNumber, setDoseNumber] = useState('');
  const [administeredDate, setAdministeredDate] = useState(today());
  const [nextDueDate, setNextDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const createVaccination = useCreateVaccination(patientId);

  function reset() {
    setVaccineName('');
    setDoseNumber('');
    setAdministeredDate(today());
    setNextDueDate('');
    setNotes('');
  }

  function submit() {
    if (!vaccineName.trim()) {
      toast.error('Enter a vaccine name');
      return;
    }
    createVaccination.mutate(
      {
        vaccineName: vaccineName.trim(),
        doseNumber: doseNumber ? Number(doseNumber) : undefined,
        administeredDate,
        nextDueDate: nextDueDate || undefined,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Vaccination recorded');
          reset();
          setOpen(false);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not record vaccination'),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a vaccination</DialogTitle>
          <DialogDescription>Recorded immediately — the patient was present when it was administered.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vaccine-name">Vaccine</Label>
              <Input id="vaccine-name" value={vaccineName} onChange={(e) => setVaccineName(e.target.value)} placeholder="e.g. Tetanus" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dose-number">Dose # (optional)</Label>
              <Input id="dose-number" type="number" min={1} value={doseNumber} onChange={(e) => setDoseNumber(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="administered-date">Administered on</Label>
              <Input id="administered-date" type="date" value={administeredDate} onChange={(e) => setAdministeredDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next-due-date">Next due (optional)</Label>
              <Input id="next-due-date" type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="vaccination-notes">Notes (optional)</Label>
            <Textarea id="vaccination-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={createVaccination.isPending}>
            {createVaccination.isPending ? 'Saving…' : 'Record vaccination'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
