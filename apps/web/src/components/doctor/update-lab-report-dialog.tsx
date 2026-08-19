'use client';

import { useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { LabReportDto } from '@clinic/shared';
import { useUpdateLabReport } from '@/hooks/doctor/use-doctor-patient';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function UpdateLabReportDialog({ patientId, report, trigger }: { patientId: string; report: LabReportDto; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [reportDate, setReportDate] = useState(report.reportDate ? report.reportDate.slice(0, 10) : '');
  const [notes, setNotes] = useState(report.notes ?? '');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateReport = useUpdateLabReport(patientId);

  function submit(markReady: boolean) {
    if (markReady && !reportDate && !report.reportDate) {
      toast.error('Enter a report date to mark this ready');
      return;
    }
    updateReport.mutate(
      { reportId: report.id, status: markReady ? 'READY' : undefined, reportDate: reportDate || undefined, notes, file: file ?? undefined },
      {
        onSuccess: () => {
          toast.success(markReady ? 'Marked ready — patient notified' : 'Report updated');
          setFile(null);
          setOpen(false);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update report'),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{report.testName}</DialogTitle>
          <DialogDescription>{report.labName ?? 'Lab not specified'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lab-report-date">Report date</Label>
            <Input id="lab-report-date" type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lab-result-notes">Result notes</Label>
            <Textarea id="lab-result-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Attach report file (optional)</Label>
            <input ref={fileInputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
            <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
              {file ? file.name : report.fileUrl ? 'Replace file' : 'Choose file'}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => submit(false)} disabled={updateReport.isPending}>
            Save
          </Button>
          {report.status !== 'READY' && (
            <Button type="button" onClick={() => submit(true)} disabled={updateReport.isPending}>
              {updateReport.isPending ? 'Saving…' : 'Mark ready'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
