'use client';

import { use } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, FileText } from 'lucide-react';
import type { ClinicVerificationStatus } from '@clinic/shared';
import { usePlatformClinicDetail, useUpdateClinicDocumentStatus } from '@/hooks/platform-admin/use-platform-admin';
import { UpdateVerificationDialog } from '@/components/platform-admin/update-verification-dialog';
import { ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/marketing/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

const TRANSITIONS: Record<ClinicVerificationStatus, ClinicVerificationStatus[]> = {
  PENDING: [],
  SUBMITTED: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['VERIFIED', 'REJECTED'],
  VERIFIED: ['SUSPENDED'],
  REJECTED: ['UNDER_REVIEW'],
  SUSPENDED: ['VERIFIED'],
};

const STATUS_VARIANT: Record<ClinicVerificationStatus, 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'outline',
  SUBMITTED: 'secondary',
  UNDER_REVIEW: 'secondary',
  VERIFIED: 'outline',
  REJECTED: 'destructive',
  SUSPENDED: 'destructive',
};

export default function PlatformAdminClinicDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: clinic, isLoading } = usePlatformClinicDetail(id);
  const updateDocumentStatus = useUpdateClinicDocumentStatus();

  if (isLoading || !clinic) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  function handleDocumentStatus(documentId: string, status: 'VERIFIED' | 'REJECTED') {
    updateDocumentStatus.mutate(
      { clinicId: clinic!.id, documentId, status },
      {
        onSuccess: () => toast.success(`Document ${status.toLowerCase()}`),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update document status'),
      },
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/platform-admin/clinics" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-medium">
        <ArrowLeft className="size-4" />
        Back to clinics
      </Link>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">{clinic.name}</CardTitle>
              <p className="text-muted-foreground text-sm">{[clinic.addressLine1, clinic.city, clinic.state].filter(Boolean).join(', ') || 'No address on file'}</p>
            </div>
            <Badge variant={STATUS_VARIANT[clinic.verificationStatus]}>{clinic.verificationStatus.replace('_', ' ')}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-xs">Legal name</p>
              <p className="text-sm font-medium">{clinic.legalName ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Registration number</p>
              <p className="text-sm font-medium">{clinic.registrationNumber ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Contact</p>
              <p className="text-sm font-medium">{[clinic.email, clinic.phone].filter(Boolean).join(' · ') || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Doctors / staff</p>
              <p className="text-sm font-medium">{clinic.doctorCount} doctors · {clinic.staffCount} staff</p>
            </div>
          </div>

          {clinic.verificationNotes && (
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">Clinic&apos;s submission notes</p>
              <p className="text-muted-foreground text-sm">{clinic.verificationNotes}</p>
              {clinic.verificationSubmittedAt && <p className="text-muted-foreground mt-1 text-xs">Submitted {formatDate(clinic.verificationSubmittedAt)}</p>}
            </div>
          )}

          {clinic.verificationReviewNotes && (
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">Reviewer notes</p>
              <p className="text-muted-foreground text-sm">{clinic.verificationReviewNotes}</p>
              {clinic.verificationReviewedAt && <p className="text-muted-foreground mt-1 text-xs">Reviewed {formatDate(clinic.verificationReviewedAt)}</p>}
            </div>
          )}

          {TRANSITIONS[clinic.verificationStatus].length > 0 && (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              {TRANSITIONS[clinic.verificationStatus].map((target) => (
                <UpdateVerificationDialog
                  key={target}
                  clinicId={clinic.id}
                  clinicName={clinic.name}
                  targetStatus={target}
                  trigger={
                    <Button size="sm" variant={target === 'REJECTED' || target === 'SUSPENDED' ? 'destructive' : 'default'}>
                      {target.replace('_', ' ')}
                    </Button>
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {clinic.documents.length === 0 ? (
            <EmptyState icon={FileText} title="No documents uploaded" description="This clinic hasn't uploaded any verification documents yet." />
          ) : (
            <div className="space-y-2">
              {clinic.documents.map((doc) => (
                <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{doc.type.replace(/_/g, ' ')}</p>
                    <p className="text-muted-foreground truncate text-xs">{doc.fileName}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={doc.status === 'VERIFIED' ? 'outline' : doc.status === 'REJECTED' ? 'destructive' : 'secondary'}>{doc.status}</Badge>
                    {doc.status !== 'VERIFIED' && (
                      <Button size="sm" variant="outline" onClick={() => handleDocumentStatus(doc.id, 'VERIFIED')} disabled={updateDocumentStatus.isPending}>
                        Verify
                      </Button>
                    )}
                    {doc.status !== 'REJECTED' && (
                      <Button size="sm" variant="outline" onClick={() => handleDocumentStatus(doc.id, 'REJECTED')} disabled={updateDocumentStatus.isPending}>
                        Reject
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
