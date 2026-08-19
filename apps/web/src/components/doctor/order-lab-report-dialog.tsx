'use client';

import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useCreateLabReport } from '@/hooks/doctor/use-doctor-patient';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function OrderLabReportDialog({ patientId, trigger }: { patientId: string; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [testName, setTestName] = useState('');
  const [labName, setLabName] = useState('');
  const [notes, setNotes] = useState('');
  const createReport = useCreateLabReport(patientId);

  function reset() {
    setTestName('');
    setLabName('');
    setNotes('');
  }

  function submit() {
    if (!testName.trim()) {
      toast.error('Enter a test name');
      return;
    }
    createReport.mutate(
      { testName: testName.trim(), labName: labName.trim() || undefined, notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Test ordered');
          reset();
          setOpen(false);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not order test'),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Order a lab test</DialogTitle>
          <DialogDescription>Shows as pending until you record the result.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lab-test-name">Test name</Label>
            <Input id="lab-test-name" value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="e.g. Complete Blood Count" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lab-name">Lab (optional)</Label>
            <Input id="lab-name" value={labName} onChange={(e) => setLabName(e.target.value)} placeholder="e.g. City Diagnostics" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lab-notes">Notes (optional)</Label>
            <Textarea id="lab-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={createReport.isPending}>
            {createReport.isPending ? 'Ordering…' : 'Order test'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
