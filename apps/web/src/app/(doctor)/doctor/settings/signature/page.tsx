'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { DoctorSignatureDto } from '@clinic/shared';
import {
  useDoctorSignature,
  useRemoveSignatureImage,
  useUpdateSignatureText,
  useUploadSignatureImage,
} from '@/hooks/doctor/use-doctor-signature';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api-client';

export default function DoctorSignatureSettingsPage() {
  const { data: signature, isLoading } = useDoctorSignature();

  if (isLoading || !signature) return <Skeleton className="h-64 w-full" />;

  return <SignatureForm signature={signature} />;
}

function SignatureForm({ signature }: { signature: DoctorSignatureDto }) {
  const updateText = useUpdateSignatureText();
  const uploadImage = useUploadSignatureImage();
  const removeImage = useRemoveSignatureImage();
  const [text, setText] = useState(signature.signatureText ?? '');

  function handleSaveText() {
    updateText.mutate(text, {
      onSuccess: () => toast.success('Signature saved'),
      onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not save signature'),
    });
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadImage.mutate(file, {
      onSuccess: () => toast.success('Signature image uploaded'),
      onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not upload signature'),
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Digital signature</CardTitle>
          <CardDescription>
            Stamped onto finalized prescriptions along with a tamper-evidence hash. This is a
            typed or uploaded signature image, not a certificate-based e-signature.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signatureText">Typed signature</Label>
            <Input id="signatureText" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Dr. Aditi Sharma, MD" />
          </div>

          <div className="space-y-2">
            <Label>Signature image (optional)</Label>
            {signature.signatureImageUrl ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={signature.signatureImageUrl} alt="Signature" className="h-16 rounded border bg-white p-2" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeImage.mutate(undefined, { onSuccess: () => toast.success('Signature image removed') })}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" render={<label htmlFor="signature-image" />}>
                  {uploadImage.isPending ? 'Uploading…' : 'Upload image'}
                </Button>
                <input id="signature-image" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveText} disabled={updateText.isPending}>
            {updateText.isPending ? 'Saving…' : 'Save signature'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
