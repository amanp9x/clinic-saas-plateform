'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { createRefundRequestSchema, type CreateRefundRequestInput } from '@clinic/shared';
import { useRequestRefund } from '@/hooks/patient/use-payments';
import { ApiError } from '@/lib/api-client';
import { formatFee } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormFieldError } from '@/components/auth/form-field-error';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function RequestRefundDialog({
  paymentId,
  refundableAmount,
  trigger,
}: {
  paymentId: string;
  refundableAmount: number;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const requestRefund = useRequestRefund(paymentId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateRefundRequestInput>({ resolver: zodResolver(createRefundRequestSchema) });

  const onSubmit = handleSubmit((data) => {
    requestRefund.mutate(
      { reason: data.reason, amount: data.amount || undefined },
      {
        onSuccess: () => {
          toast.success('Refund requested — the clinic will review it');
          reset();
          setOpen(false);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not request a refund'),
      },
    );
  });

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
          <DialogTitle>Request a refund</DialogTitle>
          <DialogDescription>
            Up to {formatFee(String(refundableAmount))} is refundable for this payment. The clinic will review your request.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="refund-amount">Amount (optional — leave blank for the full eligible amount)</Label>
            <Input id="refund-amount" type="number" step="0.01" min="0" placeholder={`Up to ${refundableAmount}`} {...register('amount')} />
            <FormFieldError message={errors.amount?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="refund-reason">Reason</Label>
            <textarea
              id="refund-reason"
              rows={4}
              className="shadow-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
              placeholder="Tell the clinic why you're requesting a refund"
              {...register('reason')}
            />
            <FormFieldError message={errors.reason?.message} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={requestRefund.isPending}>
              {requestRefund.isPending ? 'Submitting…' : 'Request refund'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
