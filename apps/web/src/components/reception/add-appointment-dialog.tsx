'use client';

import * as React from 'react';
import { toast } from 'sonner';
import type { AppointmentType, AvailableSlotDto, ConsultationType, Gender } from '@clinic/shared';
import { useReceptionDoctorStatuses } from '@/hooks/reception/use-reception-doctors';
import { useReceptionPatientSearch } from '@/hooks/reception/use-reception-patients';
import { useReceptionCreateAppointment, useReceptionSlotAvailability } from '@/hooks/reception/use-reception-booking';
import { ApiError } from '@/lib/api-client';
import { DateStrip } from '@/components/booking/date-strip';
import { SlotGrid } from '@/components/booking/slot-grid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function AddAppointmentDialog({ clinicId, trigger }: { clinicId: string; trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [doctorId, setDoctorId] = React.useState('');
  const [date, setDate] = React.useState(todayIso());
  const [consultationType, setConsultationType] = React.useState<ConsultationType>('IN_CLINIC');
  const [appointmentType, setAppointmentType] = React.useState<AppointmentType>('NEW_CONSULTATION');
  const [selectedSlot, setSelectedSlot] = React.useState<AvailableSlotDto | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [existingPatientId, setExistingPatientId] = React.useState<string | null>(null);
  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [age, setAge] = React.useState('');
  const [gender, setGender] = React.useState<Gender | ''>('');
  const [reasonForVisit, setReasonForVisit] = React.useState('');

  const { data: doctors } = useReceptionDoctorStatuses(clinicId);
  const { data: searchResults } = useReceptionPatientSearch(clinicId, searchQuery);
  const availability = useReceptionSlotAvailability(doctorId || undefined, clinicId, date, consultationType);
  const createAppointment = useReceptionCreateAppointment();

  function reset() {
    setDoctorId('');
    setDate(todayIso());
    setConsultationType('IN_CLINIC');
    setAppointmentType('NEW_CONSULTATION');
    setSelectedSlot(null);
    setSearchQuery('');
    setExistingPatientId(null);
    setFullName('');
    setPhone('');
    setAge('');
    setGender('');
    setReasonForVisit('');
  }

  function submit() {
    if (!doctorId || !selectedSlot) {
      toast.error('Select a doctor and a slot');
      return;
    }
    if (!existingPatientId && (!fullName.trim() || !phone.trim())) {
      toast.error('Provide an existing patient or a name and phone number');
      return;
    }
    createAppointment.mutate(
      {
        clinicId,
        doctorId,
        scheduledAt: selectedSlot.startAt,
        consultationType,
        appointmentType,
        reasonForVisit: reasonForVisit.trim() || undefined,
        patientId: existingPatientId ?? undefined,
        newPatient: existingPatientId
          ? undefined
          : { fullName: fullName.trim(), phone: phone.trim(), age: age ? Number(age) : undefined, gender: gender || undefined },
      },
      {
        onSuccess: (result) => {
          toast.success(`Appointment booked — ${result.appointment.bookingReference}`);
          reset();
          setOpen(false);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not book appointment'),
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add appointment</DialogTitle>
          <DialogDescription>Book a scheduled appointment for a patient at this clinic.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label>Doctor</Label>
            <Select
              value={doctorId}
              onValueChange={(value) => {
                setDoctorId(value ?? '');
                setSelectedSlot(null);
              }}
            >
              <SelectTrigger className="w-full">
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
            <Label htmlFor="patient-search">Search existing patient (optional)</Label>
            <Input
              id="patient-search"
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
            {existingPatientId && (
              <p className="text-xs text-emerald-600">Linked to existing patient — no duplicate account will be created.</p>
            )}
          </div>

          {!existingPatientId && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Patient full name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+919876543210" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input id="age" type="number" min={0} max={120} value={age} onChange={(e) => setAge(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={gender} onValueChange={(v) => setGender((v as Gender) ?? '')}>
                  <SelectTrigger className="w-full">
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
            <Label>Consultation type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={consultationType === 'IN_CLINIC' ? 'default' : 'outline'}
                onClick={() => {
                  setConsultationType('IN_CLINIC');
                  setSelectedSlot(null);
                }}
              >
                In-clinic
              </Button>
              <Button
                type="button"
                size="sm"
                variant={consultationType === 'ONLINE' ? 'default' : 'outline'}
                onClick={() => {
                  setConsultationType('ONLINE');
                  setSelectedSlot(null);
                }}
              >
                Online
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Visit type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={appointmentType === 'NEW_CONSULTATION' ? 'default' : 'outline'}
                onClick={() => setAppointmentType('NEW_CONSULTATION')}
              >
                New consultation
              </Button>
              <Button
                type="button"
                size="sm"
                variant={appointmentType === 'FOLLOW_UP' ? 'default' : 'outline'}
                onClick={() => setAppointmentType('FOLLOW_UP')}
              >
                Follow-up
              </Button>
            </div>
          </div>

          {doctorId && (
            <div className="space-y-2">
              <Label>Date &amp; slot</Label>
              <DateStrip
                selectedDate={date}
                onSelect={(d) => {
                  setDate(d);
                  setSelectedSlot(null);
                }}
                days={14}
              />
              {availability.isError ? (
                <p className="text-destructive text-sm">
                  {availability.error instanceof ApiError ? availability.error.message : 'Could not load availability'}
                </p>
              ) : (
                <SlotGrid
                  slots={availability.data?.slots ?? []}
                  closedReason={availability.data?.closedReason ?? null}
                  isLoading={availability.isLoading}
                  selectedStartAt={selectedSlot?.startAt}
                  onSelect={setSelectedSlot}
                />
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={createAppointment.isPending || !doctorId || !selectedSlot}>
            {createAppointment.isPending ? 'Booking…' : 'Book appointment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
