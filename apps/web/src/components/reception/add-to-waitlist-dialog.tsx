'use client';

import * as React from 'react';
import { toast } from 'sonner';
import type { Gender } from '@clinic/shared';
import { useReceptionDoctorStatuses } from '@/hooks/reception/use-reception-doctors';
import { useReceptionPatientSearch } from '@/hooks/reception/use-reception-patients';
import { useAddToWaitlist } from '@/hooks/reception/use-reception-waitlist';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function AddToWaitlistDialog({ clinicId, trigger }: { clinicId: string; trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [doctorId, setDoctorId] = React.useState('');
  const [targetDate, setTargetDate] = React.useState(tomorrowIso());
  const [notes, setNotes] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [existingPatientId, setExistingPatientId] = React.useState<string | null>(null);
  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [age, setAge] = React.useState('');
  const [gender, setGender] = React.useState<Gender | ''>('');

  const { data: doctors } = useReceptionDoctorStatuses(clinicId);
  const { data: searchResults } = useReceptionPatientSearch(clinicId, searchQuery);
  const addToWaitlist = useAddToWaitlist();

  function reset() {
    setDoctorId('');
    setTargetDate(tomorrowIso());
    setNotes('');
    setSearchQuery('');
    setExistingPatientId(null);
    setFullName('');
    setPhone('');
    setAge('');
    setGender('');
  }

  function submit() {
    if (!doctorId) {
      toast.error('Select a doctor');
      return;
    }
    if (!existingPatientId && (!fullName.trim() || !phone.trim())) {
      toast.error('Provide an existing patient or a name and phone number');
      return;
    }
    addToWaitlist.mutate(
      {
        clinicId,
        doctorId,
        targetDate,
        notes: notes.trim() || undefined,
        patientId: existingPatientId ?? undefined,
        newPatient: existingPatientId
          ? undefined
          : { fullName: fullName.trim(), phone: phone.trim(), age: age ? Number(age) : undefined, gender: gender || undefined },
      },
      {
        onSuccess: () => {
          toast.success('Added to waitlist');
          reset();
          setOpen(false);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not add to waitlist'),
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to waitlist</DialogTitle>
          <DialogDescription>For a patient who called or walked in asking to be waitlisted for a fully-booked doctor.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Doctor</Label>
            <Select value={doctorId} onValueChange={(value) => setDoctorId(value ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="Select a doctor" />
              </SelectTrigger>
              <SelectContent>
                {(doctors ?? []).map((d) => (
                  <SelectItem key={d.doctorId} value={d.doctorId}>
                    {d.doctorName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-date">Target date</Label>
            <input
              id="target-date"
              type="date"
              min={tomorrowIso()}
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="waitlist-patient-search">Search existing patient (optional)</Label>
            <Input
              id="waitlist-patient-search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setExistingPatientId(null);
              }}
              placeholder="Search by name or phone"
            />
            {searchQuery && (searchResults?.items.length ?? 0) > 0 && (
              <ul className="divide-y rounded-md border">
                {searchResults!.items.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setExistingPatientId(p.id);
                        setSearchQuery(p.fullName);
                      }}
                      className={`hover:bg-muted w-full px-3 py-2 text-left text-sm ${existingPatientId === p.id ? 'bg-primary/10' : ''}`}
                    >
                      {p.fullName} {p.phone ? `· ${p.phone}` : ''}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {existingPatientId && <p className="text-xs text-emerald-600">Linked to existing patient — no duplicate account will be created.</p>}
          </div>

          {!existingPatientId && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="waitlist-fullName">Full name</Label>
                <Input id="waitlist-fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Patient full name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waitlist-phone">Phone</Label>
                <Input id="waitlist-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+919876543210" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waitlist-age">Age</Label>
                <Input id="waitlist-age" type="number" min={0} max={120} value={age} onChange={(e) => setAge(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                    <SelectItem value="UNDISCLOSED">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="waitlist-notes">Notes (optional)</Label>
            <Textarea id="waitlist-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={addToWaitlist.isPending}>
            {addToWaitlist.isPending ? 'Adding…' : 'Add to waitlist'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
