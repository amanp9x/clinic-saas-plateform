'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { useReviewEligibility, useSubmitReview } from '@/hooks/patient/use-reviews';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { StarRatingInput } from './star-rating-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface DimensionRatings {
  overall?: number;
  a?: number;
  b?: number;
  c?: number;
  d?: number;
}

function emptyDimensions(): DimensionRatings {
  return {};
}

export function RateExperienceDialog({
  appointmentId,
  trigger,
}: {
  appointmentId: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const { data: eligibility, isLoading } = useReviewEligibility(open ? appointmentId : undefined);
  const submitReview = useSubmitReview();

  const [doctorRatings, setDoctorRatings] = React.useState<DimensionRatings>(emptyDimensions());
  const [doctorComment, setDoctorComment] = React.useState('');
  const [clinicRatings, setClinicRatings] = React.useState<DimensionRatings>(emptyDimensions());
  const [clinicComment, setClinicComment] = React.useState('');

  function reset() {
    setDoctorRatings(emptyDimensions());
    setDoctorComment('');
    setClinicRatings(emptyDimensions());
    setClinicComment('');
  }

  function handleSubmit() {
    if (!eligibility) return;
    const wantsDoctor = eligibility.canReviewDoctor && Boolean(doctorRatings.overall);
    const wantsClinic = eligibility.canReviewClinic && Boolean(clinicRatings.overall);

    if (!wantsDoctor && !wantsClinic) {
      toast.error('Give at least an overall rating for the doctor or the clinic');
      return;
    }

    submitReview.mutate(
      {
        appointmentId,
        doctorReview: wantsDoctor
          ? {
              rating: doctorRatings.overall!,
              consultationExperience: doctorRatings.a,
              communication: doctorRatings.b,
              professionalism: doctorRatings.c,
              explanationClarity: doctorRatings.d,
              comment: doctorComment.trim() || undefined,
            }
          : undefined,
        clinicReview: wantsClinic
          ? {
              rating: clinicRatings.overall!,
              staffExperience: clinicRatings.a,
              cleanliness: clinicRatings.b,
              waitingExperience: clinicRatings.c,
              overallExperience: clinicRatings.d,
              comment: clinicComment.trim() || undefined,
            }
          : undefined,
      },
      {
        onSuccess: () => {
          toast.success('Thank you for your feedback');
          reset();
          setOpen(false);
        },
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : 'Could not submit your review');
        },
      },
    );
  }

  const canReviewSomething = eligibility && (eligibility.canReviewDoctor || eligibility.canReviewClinic);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rate your experience</DialogTitle>
          <DialogDescription>
            {eligibility ? `Share feedback about your visit with ${eligibility.doctorName}.` : 'Share feedback about your visit.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !eligibility ? (
          <Skeleton className="h-48 w-full" />
        ) : !canReviewSomething ? (
          <p className="text-muted-foreground py-4 text-sm">
            You&apos;ve already reviewed this appointment. Thanks for your feedback!
          </p>
        ) : (
          <div className="space-y-6">
            {eligibility.canReviewDoctor && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Doctor — {eligibility.doctorName}</h3>
                <StarRatingInput label="Overall" value={doctorRatings.overall} onChange={(v) => setDoctorRatings((r) => ({ ...r, overall: v }))} />
                <StarRatingInput label="Consultation" size="sm" value={doctorRatings.a} onChange={(v) => setDoctorRatings((r) => ({ ...r, a: v }))} />
                <StarRatingInput label="Communication" size="sm" value={doctorRatings.b} onChange={(v) => setDoctorRatings((r) => ({ ...r, b: v }))} />
                <StarRatingInput label="Professionalism" size="sm" value={doctorRatings.c} onChange={(v) => setDoctorRatings((r) => ({ ...r, c: v }))} />
                <StarRatingInput label="Clarity of explanation" size="sm" value={doctorRatings.d} onChange={(v) => setDoctorRatings((r) => ({ ...r, d: v }))} />
                <div className="space-y-1.5">
                  <Label htmlFor="doctor-comment">Comment (optional)</Label>
                  <Textarea
                    id="doctor-comment"
                    rows={3}
                    value={doctorComment}
                    onChange={(e) => setDoctorComment(e.target.value)}
                    placeholder="How was your consultation?"
                  />
                </div>
              </div>
            )}

            {eligibility.canReviewClinic && (
              <div className="space-y-3 border-t pt-4">
                <h3 className="text-sm font-medium">Clinic — {eligibility.clinicName}</h3>
                <StarRatingInput label="Overall" value={clinicRatings.overall} onChange={(v) => setClinicRatings((r) => ({ ...r, overall: v }))} />
                <StarRatingInput label="Staff experience" size="sm" value={clinicRatings.a} onChange={(v) => setClinicRatings((r) => ({ ...r, a: v }))} />
                <StarRatingInput label="Cleanliness" size="sm" value={clinicRatings.b} onChange={(v) => setClinicRatings((r) => ({ ...r, b: v }))} />
                <StarRatingInput label="Waiting experience" size="sm" value={clinicRatings.c} onChange={(v) => setClinicRatings((r) => ({ ...r, c: v }))} />
                <StarRatingInput label="Overall experience" size="sm" value={clinicRatings.d} onChange={(v) => setClinicRatings((r) => ({ ...r, d: v }))} />
                <div className="space-y-1.5">
                  <Label htmlFor="clinic-comment">Comment (optional)</Label>
                  <Textarea
                    id="clinic-comment"
                    rows={3}
                    value={clinicComment}
                    onChange={(e) => setClinicComment(e.target.value)}
                    placeholder="How was the clinic itself — staff, cleanliness, wait time?"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {canReviewSomething ? 'Cancel' : 'Close'}
          </Button>
          {canReviewSomething && (
            <Button type="button" onClick={handleSubmit} disabled={submitReview.isPending}>
              {submitReview.isPending ? 'Submitting…' : 'Submit review'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
