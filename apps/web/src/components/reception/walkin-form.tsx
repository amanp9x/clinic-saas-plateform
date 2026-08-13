'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Gender, TokenPriority, WalkInPaymentStatus } from '@clinic/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useReceptionDoctorStatuses } from '@/hooks/reception/use-reception-doctors';
import { useReceptionPatientSearch } from '@/hooks/reception/use-reception-patients';
import { useReceptionWalkIn } from '@/hooks/reception/use-reception-appointments';
import { ApiError } from '@/lib/api-client';

export function WalkInForm({ clinicId }: { clinicId: string }) {
  const router = useRouter();
  const { data: doctors } = useReceptionDoctorStatuses(clinicId);
  const walkIn = useReceptionWalkIn();

  const [doctorId, setDoctorId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [existingPatientId, setExistingPatientId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<WalkInPaymentStatus>('PENDING');
  const [priority, setPriority] = useState<TokenPriority>('NORMAL');

  const { data: searchResults } = useReceptionPatientSearch(clinicId, searchQuery);

  function reset() {
    setExistingPatientId(null);
    setSearchQuery('');
    setFullName('');
    setPhone('');
    setAge('');
    setGender('');
    setReasonForVisit('');
    setPaymentStatus('PENDING');
    setPriority('NORMAL');
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
    walkIn.mutate(
      {
        clinicId,
        doctorId,
        existingPatientId: existingPatientId ?? undefined,
        fullName: existingPatientId ? undefined : fullName.trim(),
        phone: existingPatientId ? undefined : phone.trim(),
        age: age ? Number(age) : undefined,
        gender: gender || undefined,
        reasonForVisit: reasonForVisit.trim() || undefined,
        paymentStatus,
        priority,
      },
      {
        onSuccess: () => {
          toast.success('Walk-in registered and checked in');
          reset();
          router.push(`/reception/queue?doctorId=${doctorId}`);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not register walk-in'),
      },
    );
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Register Walk-in Patient</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
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
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${existingPatientId === p.id ? 'bg-primary/10' : ''}`}
                  >
                    {p.fullName} {p.phone ? `· ${p.phone}` : ''}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {existingPatientId && <p className="text-emerald-600 text-xs">Linked to existing patient — no duplicate account will be created.</p>}
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
          <Label htmlFor="reason">Reason for visit</Label>
          <Textarea id="reason" value={reasonForVisit} onChange={(e) => setReasonForVisit(e.target.value)} rows={2} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as TokenPriority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NORMAL">Normal</SelectItem>
                <SelectItem value="FOLLOW_UP">Follow-up</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
                <SelectItem value="EMERGENCY">Emergency</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Payment status</Label>
            <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as WalkInPaymentStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="WAIVED">Waived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button className="w-full" onClick={submit} disabled={walkIn.isPending}>
          {walkIn.isPending ? 'Registering…' : 'Register & Check In'}
        </Button>
      </CardContent>
    </Card>
  );
}
