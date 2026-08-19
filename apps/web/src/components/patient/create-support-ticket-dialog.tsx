'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { SupportTicketCategory } from '@clinic/shared';
import { useCreateSupportTicket } from '@/hooks/patient/use-support-tickets';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const CATEGORY_OPTIONS: { value: SupportTicketCategory; label: string }[] = [
  { value: 'APPOINTMENT', label: 'Appointment' },
  { value: 'PAYMENT', label: 'Payment or billing' },
  { value: 'DOCTOR_CONDUCT', label: 'Doctor conduct' },
  { value: 'CLINIC_SERVICE', label: 'Clinic service' },
  { value: 'TECHNICAL', label: 'App or technical issue' },
  { value: 'OTHER', label: 'Other' },
];

export function CreateSupportTicketDialog({ trigger }: { trigger: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<SupportTicketCategory>('OTHER');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const createTicket = useCreateSupportTicket();

  function reset() {
    setCategory('OTHER');
    setSubject('');
    setDescription('');
  }

  function submit() {
    if (subject.trim().length < 3) {
      toast.error('Enter a subject for your ticket');
      return;
    }
    if (description.trim().length < 10) {
      toast.error('Please describe the issue in a bit more detail');
      return;
    }
    createTicket.mutate(
      { category, subject: subject.trim(), description: description.trim() },
      {
        onSuccess: (data) => {
          toast.success('Support ticket submitted');
          reset();
          setOpen(false);
          router.push(`/support/tickets/${data.ticket.id}`);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not submit ticket'),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New support ticket</DialogTitle>
          <DialogDescription>Tell us what went wrong — our support team will follow up here.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ticket-category">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as SupportTicketCategory)}>
              <SelectTrigger id="ticket-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket-subject">Subject</Label>
            <Input id="ticket-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder="Short summary of the issue" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket-description">Description</Label>
            <Textarea id="ticket-description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} placeholder="What happened, and what did you expect instead?" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={createTicket.isPending}>
            {createTicket.isPending ? 'Submitting…' : 'Submit ticket'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
