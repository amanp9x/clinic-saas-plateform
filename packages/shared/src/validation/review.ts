import { z } from 'zod';
import { REVIEW_STATUSES, REVIEW_TYPES } from '../types/review.js';

const dimensionScore = z.coerce.number().int().min(1).max(5);

export const submitDoctorReviewSchema = z.object({
  rating: dimensionScore,
  consultationExperience: dimensionScore.optional(),
  communication: dimensionScore.optional(),
  professionalism: dimensionScore.optional(),
  explanationClarity: dimensionScore.optional(),
  comment: z.string().trim().max(2000).optional().or(z.literal('')),
});

export const submitClinicReviewSchema = z.object({
  rating: dimensionScore,
  staffExperience: dimensionScore.optional(),
  cleanliness: dimensionScore.optional(),
  waitingExperience: dimensionScore.optional(),
  overallExperience: dimensionScore.optional(),
  comment: z.string().trim().max(2000).optional().or(z.literal('')),
});

export const createReviewSchema = z
  .object({
    appointmentId: z.string().uuid('Select an appointment'),
    doctorReview: submitDoctorReviewSchema.optional(),
    clinicReview: submitClinicReviewSchema.optional(),
  })
  .refine((v) => v.doctorReview || v.clinicReview, {
    message: 'Provide at least a doctor review or a clinic review',
    path: ['doctorReview'],
  });
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const updateReviewSchema = z.object({
  rating: dimensionScore.optional(),
  consultationExperience: dimensionScore.nullable().optional(),
  communication: dimensionScore.nullable().optional(),
  professionalism: dimensionScore.nullable().optional(),
  explanationClarity: dimensionScore.nullable().optional(),
  staffExperience: dimensionScore.nullable().optional(),
  cleanliness: dimensionScore.nullable().optional(),
  waitingExperience: dimensionScore.nullable().optional(),
  overallExperience: dimensionScore.nullable().optional(),
  comment: z.string().trim().max(2000).nullable().optional(),
});
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

export const reviewIdParamSchema = z.object({
  id: z.string().uuid('Invalid review id'),
});

export const eligibilityQuerySchema = z.object({
  appointmentId: z.string().uuid('Select an appointment'),
});

export const reviewTypeQuerySchema = z.object({
  type: z.enum(REVIEW_TYPES).optional(),
});

export const myReviewsQuerySchema = z.object({
  type: z.enum(REVIEW_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const publicReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const moderationQueueQuerySchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  type: z.enum(REVIEW_TYPES).optional(),
  status: z.enum(REVIEW_STATUSES).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  doctorId: z.string().uuid().optional(),
  from: z.string().date('Enter a valid date').optional(),
  to: z.string().date('Enter a valid date').optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ModerationQueueQuery = z.infer<typeof moderationQueueQuerySchema>;

export const moderateReviewSchema = z.object({
  status: z.enum(REVIEW_STATUSES),
  reason: z.string().trim().max(500).optional().or(z.literal('')),
});
export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;

export const reviewResponseSchema = z.object({
  response: z.string().trim().min(1, 'Enter a response').max(1000),
});
export type ReviewResponseInput = z.infer<typeof reviewResponseSchema>;
