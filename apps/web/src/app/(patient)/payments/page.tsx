'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { usePaymentHistory, downloadReceipt } from '@/hooks/patient/use-payments';
import { ApiError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';

const STATUS_VARIANT: Record<string, 'secondary' | 'outline' | 'destructive'> = {
  CAPTURED: 'secondary',
  REFUNDED: 'outline',
  PARTIALLY_REFUNDED: 'outline',
  FAILED: 'destructive',
  CANCELLED: 'destructive',
};

function formatMoney(amount: number, currency: string): string {
  const symbol = currency === 'INR' ? '₹' : `${currency} `;
  return `${symbol}${amount.toLocaleString('en-IN')}`;
}

function PaymentsContent() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = usePaymentHistory(page, 10);

  async function handleDownload(paymentId: string, invoiceNumber: string) {
    try {
      await downloadReceipt(paymentId, `${invoiceNumber}.pdf`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not download receipt');
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Payments</h1>
        <p className="text-muted-foreground text-sm">Your payment history and invoices.</p>
      </div>

      <Card>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !data || data.items.length === 0 ? (
            <EmptyState title="No payments yet" description="Payments for your appointments will appear here." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Appointment</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link href={`/appointments/${p.appointmentId}`} className="font-medium hover:underline">
                          {p.doctorName}
                        </Link>
                        <p className="text-muted-foreground text-xs">
                          {p.clinicName} · {p.bookingReference}
                        </p>
                      </TableCell>
                      <TableCell>{formatDateTime(p.createdAt)}</TableCell>
                      <TableCell>{formatMoney(p.amount, p.currency)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[p.status] ?? 'outline'}>{p.status.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {p.invoiceNumber ? (
                          <Button size="sm" variant="outline" onClick={() => handleDownload(p.id, p.invoiceNumber!)}>
                            Invoice
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <span className="text-muted-foreground text-sm">
                    Page {data.page} of {data.totalPages}
                  </span>
                  <Button size="sm" variant="outline" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PatientPaymentsPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-4xl" />}>
      <PaymentsContent />
    </Suspense>
  );
}
