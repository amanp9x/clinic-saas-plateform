-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CLINIC_VERIFICATION_UPDATED';

-- AlterTable
ALTER TABLE "clinics" ADD COLUMN     "verificationReviewNotes" TEXT,
ADD COLUMN     "verificationReviewedAt" TIMESTAMP(3),
ADD COLUMN     "verificationReviewedByUserId" TEXT;
