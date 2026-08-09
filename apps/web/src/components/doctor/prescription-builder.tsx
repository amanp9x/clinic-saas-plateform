'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import type { DoctorPrescriptionDto, PrescriptionItemInput } from '@clinic/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PrescriptionItemRow } from './prescription-item-row';
import { useCreatePrescription, useFinalizePrescription, useUpdatePrescription } from '@/hooks/doctor/use-prescriptions';
import { ApiError } from '@/lib/api-client';

const EMPTY_ITEM: PrescriptionItemInput = {
  medicineName: '',
  dosage: '',
  frequency: '',
  duration: '',
  route: '',
  instructions: '',
  quantity: '',
};

export function PrescriptionBuilder({
  patientId,
  appointmentId,
  existing,
}: {
  patientId: string;
  appointmentId?: string;
  existing?: DoctorPrescriptionDto;
}) {
  const router = useRouter();
  const createPrescription = useCreatePrescription();
  const updatePrescription = useUpdatePrescription();
  const finalizePrescription = useFinalizePrescription();

  const [diagnosis, setDiagnosis] = useState(existing?.diagnosis ?? '');
  const [advice, setAdvice] = useState(existing?.advice ?? '');
  const [followUpDate, setFollowUpDate] = useState(existing?.followUpDate?.slice(0, 10) ?? '');
  const [labTests, setLabTests] = useState(existing?.labTestRecommendation.join(', ') ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [items, setItems] = useState<PrescriptionItemInput[]>(
    existing?.items.length
      ? existing.items.map((i) => ({
          medicineName: i.medicineName,
          dosage: i.dosage,
          frequency: i.frequency,
          duration: i.duration,
          route: i.route ?? '',
          instructions: i.instructions ?? '',
          beforeAfterFood: i.beforeAfterFood ?? undefined,
          quantity: i.quantity ?? '',
        }))
      : [{ ...EMPTY_ITEM }],
  );

  const isFinalized = existing?.status === 'FINALIZED';
  const isSaving = createPrescription.isPending || updatePrescription.isPending;

  function buildPayload() {
    return {
      diagnosis,
      advice,
      followUpDate: followUpDate || null,
      labTestRecommendation: labTests
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      items,
      notes,
    };
  }

  function handleSave() {
    if (items.some((i) => !i.medicineName.trim() || !i.dosage.trim() || !i.frequency.trim() || !i.duration.trim())) {
      toast.error('Fill in medicine name, dosage, frequency, and duration for every item');
      return;
    }

    if (existing) {
      updatePrescription.mutate(
        { id: existing.id, ...buildPayload() },
        {
          onSuccess: () => toast.success('Prescription saved'),
          onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not save prescription'),
        },
      );
    } else {
      createPrescription.mutate(
        { patientId, appointmentId, ...buildPayload() },
        {
          onSuccess: (data) => {
            toast.success('Draft created');
            router.replace(`/doctor/prescriptions/${data.prescription.id}`);
          },
          onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not create prescription'),
        },
      );
    }
  }

  function handleFinalize() {
    if (!existing) return;
    finalizePrescription.mutate(existing.id, {
      onSuccess: () => toast.success('Prescription finalized'),
      onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not finalize prescription'),
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Diagnosis & Advice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="diagnosis">Diagnosis</Label>
            <Textarea id="diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} disabled={isFinalized} rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="advice">Advice</Label>
            <Textarea id="advice" value={advice} onChange={(e) => setAdvice(e.target.value)} disabled={isFinalized} rows={2} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="followUpDate">Follow-up date</Label>
              <Input id="followUpDate" type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} disabled={isFinalized} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="labTests">Recommended lab tests (comma separated)</Label>
              <Input id="labTests" value={labTests} onChange={(e) => setLabTests(e.target.value)} disabled={isFinalized} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Medicines</CardTitle>
          {!isFinalized && (
            <Button type="button" variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}>
              <Plus className="size-4" />
              Add medicine
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item, index) =>
            isFinalized ? (
              <div key={index} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">
                  {item.medicineName} — {item.dosage}
                </p>
                <p className="text-muted-foreground">
                  {item.frequency} · {item.duration}
                  {item.route ? ` · ${item.route}` : ''}
                  {item.quantity ? ` · ${item.quantity}` : ''}
                </p>
                {item.instructions && <p className="text-muted-foreground">{item.instructions}</p>}
              </div>
            ) : (
              <PrescriptionItemRow
                key={index}
                item={item}
                index={index}
                onChange={(i, next) => setItems((prev) => prev.map((p, idx) => (idx === i ? next : p)))}
                onRemove={(i) => setItems((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))}
              />
            ),
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isFinalized} rows={2} placeholder="Internal notes (not shown on the PDF)" />
        </CardContent>
      </Card>

      {!isFinalized && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving…' : existing ? 'Save changes' : 'Save draft'}
          </Button>
          {existing && (
            <Button onClick={handleFinalize} disabled={finalizePrescription.isPending}>
              {finalizePrescription.isPending ? 'Finalizing…' : 'Finalize & Generate PDF'}
            </Button>
          )}
        </div>
      )}

      {isFinalized && existing?.pdfUrl && (
        <div className="flex justify-end">
          <Button render={<a href={existing.pdfUrl} target="_blank" rel="noreferrer" />}>View PDF</Button>
        </div>
      )}
    </div>
  );
}
