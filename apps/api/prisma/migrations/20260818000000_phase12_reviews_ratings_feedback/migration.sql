-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN', 'REJECTED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'REVIEW_HIDDEN';

-- AlterTable
ALTER TABLE "clinics" ADD COLUMN     "ratingAverage" DOUBLE PRECISION,
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
-- `updatedAt` backfills existing rows via DEFAULT CURRENT_TIMESTAMP (Prisma's `@updatedAt`
-- annotation manages it at the ORM layer on every subsequent write; the DB default only covers
-- the 36 pre-existing seeded rows and any future direct-SQL insert).
ALTER TABLE "doctor_reviews" ADD COLUMN     "appointmentId" TEXT,
ADD COLUMN     "communication" INTEGER,
ADD COLUMN     "consultationExperience" INTEGER,
ADD COLUMN     "explanationClarity" INTEGER,
ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderatedByUserId" TEXT,
ADD COLUMN     "moderationReason" TEXT,
ADD COLUMN     "patientId" TEXT,
ADD COLUMN     "professionalism" INTEGER,
ADD COLUMN     "respondedByUserId" TEXT,
ADD COLUMN     "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "comment" DROP NOT NULL;

-- CreateTable
CREATE TABLE "clinic_reviews" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "staffExperience" INTEGER,
    "cleanliness" INTEGER,
    "waitingExperience" INTEGER,
    "overallExperience" INTEGER,
    "comment" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "moderatedByUserId" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "moderationReason" TEXT,
    "response" TEXT,
    "respondedAt" TIMESTAMP(3),
    "respondedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clinic_reviews_appointmentId_key" ON "clinic_reviews"("appointmentId");

-- CreateIndex
CREATE INDEX "clinic_reviews_clinicId_idx" ON "clinic_reviews"("clinicId");

-- CreateIndex
CREATE INDEX "clinic_reviews_clinicId_status_idx" ON "clinic_reviews"("clinicId", "status");

-- CreateIndex
CREATE INDEX "clinic_reviews_patientId_idx" ON "clinic_reviews"("patientId");

-- CreateIndex
CREATE INDEX "clinic_reviews_status_idx" ON "clinic_reviews"("status");

-- CreateIndex
CREATE INDEX "clinic_reviews_createdAt_idx" ON "clinic_reviews"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_reviews_appointmentId_key" ON "doctor_reviews"("appointmentId");

-- CreateIndex
CREATE INDEX "doctor_reviews_doctorId_status_idx" ON "doctor_reviews"("doctorId", "status");

-- CreateIndex
CREATE INDEX "doctor_reviews_patientId_idx" ON "doctor_reviews"("patientId");

-- CreateIndex
CREATE INDEX "doctor_reviews_status_idx" ON "doctor_reviews"("status");

-- CreateIndex
CREATE INDEX "doctor_reviews_createdAt_idx" ON "doctor_reviews"("createdAt");

-- AddForeignKey
ALTER TABLE "doctor_reviews" ADD CONSTRAINT "doctor_reviews_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_reviews" ADD CONSTRAINT "doctor_reviews_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_reviews" ADD CONSTRAINT "clinic_reviews_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_reviews" ADD CONSTRAINT "clinic_reviews_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_reviews" ADD CONSTRAINT "clinic_reviews_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
