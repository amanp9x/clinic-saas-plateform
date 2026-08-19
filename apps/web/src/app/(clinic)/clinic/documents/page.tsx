'use client';

import { Suspense, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { ClinicDocumentDto, ClinicDocumentType, DocumentExpiryStatus } from '@clinic/shared';
import { useSelectedClinic } from '@/hooks/clinic/use-selected-clinic';
import {
  downloadClinicDocument,
  useClinicDocuments,
  useDeleteClinicDocument,
  useUpdateClinicDocumentExpiry,
  useUploadClinicDocument,
} from '@/hooks/clinic/use-clinic-documents';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { ApiError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';

const DOCUMENT_TYPES: ClinicDocumentType[] = ['REGISTRATION_CERTIFICATE', 'LICENSE', 'TAX_DOCUMENT', 'OTHER'];

const EXPIRY_BADGE_VARIANT: Record<DocumentExpiryStatus, 'secondary' | 'outline' | 'destructive'> = {
  NOT_TRACKED: 'secondary',
  VALID: 'outline',
  EXPIRING_SOON: 'destructive',
  EXPIRED: 'destructive',
};

const EXPIRY_BADGE_LABEL: Record<DocumentExpiryStatus, string> = {
  NOT_TRACKED: 'Not tracked',
  VALID: 'Valid',
  EXPIRING_SOON: 'Expiring soon',
  EXPIRED: 'Expired',
};

function ExpiryCell({ document, clinicId }: { document: ClinicDocumentDto; clinicId: string }) {
  const updateExpiry = useUpdateClinicDocumentExpiry(clinicId);
  const [value, setValue] = useState(document.expiryDate ?? '');

  function save() {
    if (value === (document.expiryDate ?? '')) return;
    updateExpiry.mutate(
      { documentId: document.id, expiryDate: value || null },
      {
        onSuccess: () => toast.success('Expiry date updated'),
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : 'Could not update expiry date');
          setValue(document.expiryDate ?? '');
        },
      },
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input type="date" value={value} onChange={(e) => setValue(e.target.value)} onBlur={save} className="h-8 w-36" disabled={updateExpiry.isPending} />
      <Badge variant={EXPIRY_BADGE_VARIANT[document.expiryStatus]}>{EXPIRY_BADGE_LABEL[document.expiryStatus]}</Badge>
    </div>
  );
}

function DocumentsContent() {
  const { clinicId, isLoading: clinicLoading } = useSelectedClinic();
  const { data: documents, isLoading } = useClinicDocuments(clinicId);
  const upload = useUploadClinicDocument(clinicId);
  const remove = useDeleteClinicDocument(clinicId);
  const [docType, setDocType] = useState<ClinicDocumentType>('REGISTRATION_CERTIFICATE');
  const [uploadExpiry, setUploadExpiry] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !clinicId) return;
    upload.mutate(
      { file, type: docType, expiryDate: uploadExpiry || undefined },
      {
        onSuccess: () => {
          toast.success('Document uploaded');
          setUploadExpiry('');
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not upload document'),
      },
    );
    e.target.value = '';
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Clinic Documents</h1>
        <p className="text-muted-foreground text-sm">Registration certificates, licenses, and tax documents — privately stored. Set an expiry date to get renewal reminders.</p>
      </div>

      {clinicLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !clinicId ? (
        <EmptyState title="No clinic associated" description="You are not assigned to any clinic yet." />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 pt-6">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Type</Label>
                <Select value={docType} onValueChange={(v) => v && setDocType(v as ClinicDocumentType)}>
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Expiry date (optional)</Label>
                <Input type="date" value={uploadExpiry} onChange={(e) => setUploadExpiry(e.target.value)} className="w-40" />
              </div>
              <input ref={fileInputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleFileSelected} className="hidden" />
              <Button onClick={() => fileInputRef.current?.click()} disabled={upload.isPending}>
                {upload.isPending ? 'Uploading…' : 'Upload document'}
              </Button>
            </CardContent>
          </Card>

          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (documents?.length ?? 0) === 0 ? (
            <EmptyState title="No documents uploaded" description="Upload verification documents to support your clinic profile." />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents!.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.fileName}</TableCell>
                        <TableCell>{doc.type.replace(/_/g, ' ')}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{doc.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <ExpiryCell document={doc} clinicId={clinicId} />
                        </TableCell>
                        <TableCell>{formatDateTime(doc.createdAt)}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadClinicDocument(clinicId, doc.id, doc.fileName).catch(() => toast.error('Could not download document'))}
                          >
                            Download
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              remove.mutate(doc.id, {
                                onSuccess: () => toast.success('Document deleted'),
                                onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not delete document'),
                              })
                            }
                            disabled={remove.isPending}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClinicDocumentsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <DocumentsContent />
    </Suspense>
  );
}
