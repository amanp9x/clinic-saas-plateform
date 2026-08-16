'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { useAppointment } from '@/hooks/patient/use-appointments';
import { usePayment, useCreatePaymentOrder, useSimulateCheckout, useVerifyPayment, useRetryPayment, downloadReceipt } from '@/hooks/patient/use-payments';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { ApiError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';

function formatMoney(amount: number, currency: string): string {
  const symbol = currency === 'INR' ? '₹' : `${currency} `;
  return `${symbol}${amount.toLocaleString('en-IN')}`;
}

export default function PaymentPage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = use(params);
  const router = useRouter();
  const [processing, setProcessing] = useState(false);

  const { data: appointment, isLoading: appointmentLoading } = useAppointment(appointmentId);
  const { data: payment, isLoading: paymentLoading } = usePayment(appointment?.paymentId ?? undefined);
  const createOrder = useCreatePaymentOrder();
  const simulate = useSimulateCheckout();
  const verify = useVerifyPayment();
  const retry = useRetryPayment();

  if (appointmentLoading) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState title="Appointment not found" description="This appointment may have been removed." />
      </div>
    );
  }

  async function payNow(orderPaymentId: string, orderProviderOrderId: string) {
    setProcessing(true);
    try {
      const checkout = await simulate.mutateAsync({ paymentId: orderPaymentId, outcome: 'success' });
      if (!checkout.providerSignature) {
        toast.error('Payment was declined by the provider');
        return;
      }
      await verify.mutateAsync({
        paymentId: orderPaymentId,
        providerOrderId: orderProviderOrderId,
        providerPaymentId: checkout.providerPaymentId,
        providerSignature: checkout.providerSignature,
      });
      toast.success('Payment successful — appointment confirmed');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Payment could not be verified');
    } finally {
      setProcessing(false);
    }
  }

  async function startPayment() {
    try {
      const result = await createOrder.mutateAsync(appointmentId);
      await payNow(result.order.paymentId, result.order.providerOrderId);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not start payment');
    }
  }

  async function retryPayment() {
    if (!payment) return;
    try {
      const result = await retry.mutateAsync(payment.id);
      await payNow(payment.id, result.order.providerOrderId);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not retry payment');
    }
  }

  async function handleDownloadReceipt() {
    if (!payment?.invoiceNumber) return;
    try {
      await downloadReceipt(payment.id, `${payment.invoiceNumber}.pdf`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not download receipt');
    }
  }

  const alreadySettled = appointment.status === 'CONFIRMED' && appointment.paymentStatus !== 'PENDING' && appointment.paymentStatus !== 'CREATED';

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Payment</h1>
        <p className="text-muted-foreground text-sm">{appointment.bookingReference}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appointment summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Doctor</span>
            <span className="font-medium">{appointment.doctorName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Clinic</span>
            <span className="font-medium">{appointment.clinicName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date &amp; time</span>
            <span className="font-medium">{formatDateTime(appointment.scheduledAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Consultation type</span>
            <span className="font-medium">{appointment.consultationType === 'ONLINE' ? 'Online' : 'In-clinic'}</span>
          </div>
        </CardContent>
      </Card>

      {appointment.status === 'CANCELLED' ? (
        <EmptyState title="Appointment cancelled" description="This appointment was cancelled and no longer requires payment." />
      ) : alreadySettled ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="text-emerald-500 size-10" />
            <p className="font-medium">
              {appointment.paymentStatus ? 'Payment successful' : 'No payment required'} — appointment confirmed
            </p>
            <p className="text-muted-foreground text-sm">Reference: {appointment.bookingReference}</p>
            <div className="flex gap-2">
              <Button render={<Link href={`/appointments/${appointment.id}`} />}>View appointment</Button>
              {payment?.invoiceNumber && (
                <Button variant="outline" onClick={handleDownloadReceipt}>
                  Download receipt
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : paymentLoading && appointment.paymentId ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4" /> Complete payment
              {payment?.provider === 'MOCK' && (
                <Badge variant="secondary" className="ml-auto">
                  Test mode
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {payment ? (
              <>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatMoney(payment.subtotal, payment.currency)}</span>
                  </div>
                  {payment.tax > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax</span>
                      <span>{formatMoney(payment.tax, payment.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1 font-semibold">
                    <span>Total</span>
                    <span>{formatMoney(payment.amount, payment.currency)}</span>
                  </div>
                </div>

                {payment.status === 'FAILED' && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                    <XCircle className="text-destructive size-4 shrink-0" />
                    <span>Payment failed. You can retry below.</span>
                  </div>
                )}
                {payment.status === 'CANCELLED' && <EmptyState title="Payment window expired" description="Please book the appointment again to pay." />}

                {(payment.status === 'CREATED' || payment.status === 'PENDING') && payment.providerOrderId && (
                  <Button className="w-full" onClick={() => payNow(payment.id, payment.providerOrderId!)} disabled={processing}>
                    {processing ? 'Processing…' : `Pay ${formatMoney(payment.amount, payment.currency)}`}
                  </Button>
                )}
                {payment.status === 'FAILED' && (
                  <Button className="w-full" onClick={retryPayment} disabled={processing || retry.isPending}>
                    {processing || retry.isPending ? 'Retrying…' : 'Retry payment'}
                  </Button>
                )}
              </>
            ) : (
              <Button className="w-full" onClick={startPayment} disabled={processing || createOrder.isPending}>
                {processing || createOrder.isPending ? 'Starting payment…' : 'Proceed to payment'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="text-center">
        <button type="button" onClick={() => router.push(`/appointments/${appointment.id}`)} className="text-muted-foreground text-sm hover:underline">
          Return to appointment
        </button>
      </div>
    </div>
  );
}
