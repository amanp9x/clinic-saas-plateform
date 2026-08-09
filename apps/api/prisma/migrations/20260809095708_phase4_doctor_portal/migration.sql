/*
  Warnings:

  - Added the required column `updatedAt` to the `prescriptions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DoctorSessionStatus" AS ENUM ('NOT_ARRIVED', 'ARRIVED', 'AVAILABLE', 'IN_CONSULTATION', 'ON_BREAK', 'DELAYED', 'UNAVAILABLE', 'SESSION_ENDED');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('WAITING', 'CALLED', 'IN_CONSULTATION', 'COMPLETED', 'SKIPPED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('SCHEDULED', 'WALK_IN', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateEnum
CREATE TYPE "FoodTiming" AS ENUM ('BEFORE_FOOD', 'AFTER_FOOD', 'WITH_FOOD', 'ANYTIME');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('LEAVE', 'HOLIDAY');

-- AlterTable
ALTER TABLE "clinic_doctors" ADD COLUMN     "canOverrideDelay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consultationDurationMinutesOverride" INTEGER,
ADD COLUMN     "consultationFeeOverride" DECIMAL(10,2),
ADD COLUMN     "isAcceptingAppointments" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "doctor_reviews" ADD COLUMN     "respondedAt" TIMESTAMP(3),
ADD COLUMN     "response" TEXT;

-- AlterTable
ALTER TABLE "medical_records" ADD COLUMN     "doctorId" TEXT;

-- AlterTable
ALTER TABLE "prescriptions" ADD COLUMN     "advice" TEXT,
ADD COLUMN     "consultationId" TEXT,
ADD COLUMN     "diagnosis" TEXT,
ADD COLUMN     "followUpDate" TIMESTAMP(3),
ADD COLUMN     "labTestRecommendation" TEXT[],
ADD COLUMN     "pdfUrl" TEXT,
ADD COLUMN     "signatureHash" TEXT,
ADD COLUMN     "signatureImageUrl" TEXT,
ADD COLUMN     "signedAt" TIMESTAMP(3),
ADD COLUMN     "status" "PrescriptionStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "doctor_availability" (
    "id" TEXT NOT NULL,
    "clinicDoctorId" TEXT NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "startTime" TIME NOT NULL,
    "endTime" TIME NOT NULL,
    "consultationDurationMinutes" INTEGER NOT NULL,
    "breakStartTime" TIME,
    "breakEndTime" TIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_leaves" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "clinicId" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT,
    "type" "LeaveType" NOT NULL DEFAULT 'LEAVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_sessions" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "sessionDate" DATE NOT NULL,
    "status" "DoctorSessionStatus" NOT NULL DEFAULT 'NOT_ARRIVED',
    "queueStatus" "QueueStatus" NOT NULL DEFAULT 'CLOSED',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "currentTokenId" TEXT,
    "averageConsultationMinutes" INTEGER,
    "delayMinutes" INTEGER,
    "delayReason" TEXT,
    "delayUpdatedAt" TIMESTAMP(3),
    "delayUpdatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_tokens" (
    "id" TEXT NOT NULL,
    "doctorSessionId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "patientId" TEXT NOT NULL,
    "tokenNumber" INTEGER NOT NULL,
    "type" "TokenType" NOT NULL DEFAULT 'SCHEDULED',
    "status" "TokenStatus" NOT NULL DEFAULT 'WAITING',
    "calledAt" TIMESTAMP(3),
    "calledCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "skipReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queue_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultations" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "tokenId" TEXT,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "chiefComplaint" TEXT,
    "symptoms" TEXT[],
    "heightCm" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "temperatureC" DOUBLE PRECISION,
    "bloodPressureSystolic" INTEGER,
    "bloodPressureDiastolic" INTEGER,
    "pulseRate" INTEGER,
    "respiratoryRate" INTEGER,
    "spo2" INTEGER,
    "diagnosis" TEXT,
    "doctorNotes" TEXT,
    "treatmentPlan" TEXT,
    "followUpDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "medicineName" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "route" TEXT,
    "instructions" TEXT,
    "beforeAfterFood" "FoodTiming",
    "quantity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_signatures" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "signatureImageUrl" TEXT,
    "signatureText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "doctor_availability_clinicDoctorId_idx" ON "doctor_availability"("clinicDoctorId");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_availability_clinicDoctorId_weekday_startTime_key" ON "doctor_availability"("clinicDoctorId", "weekday", "startTime");

-- CreateIndex
CREATE INDEX "doctor_leaves_doctorId_startDate_endDate_idx" ON "doctor_leaves"("doctorId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "doctor_sessions_clinicId_sessionDate_idx" ON "doctor_sessions"("clinicId", "sessionDate");

-- CreateIndex
CREATE INDEX "doctor_sessions_status_idx" ON "doctor_sessions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_sessions_doctorId_clinicId_sessionDate_key" ON "doctor_sessions"("doctorId", "clinicId", "sessionDate");

-- CreateIndex
CREATE UNIQUE INDEX "queue_tokens_appointmentId_key" ON "queue_tokens"("appointmentId");

-- CreateIndex
CREATE INDEX "queue_tokens_doctorSessionId_status_idx" ON "queue_tokens"("doctorSessionId", "status");

-- CreateIndex
CREATE INDEX "queue_tokens_patientId_idx" ON "queue_tokens"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "queue_tokens_doctorSessionId_tokenNumber_key" ON "queue_tokens"("doctorSessionId", "tokenNumber");

-- CreateIndex
CREATE UNIQUE INDEX "consultations_appointmentId_key" ON "consultations"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "consultations_tokenId_key" ON "consultations"("tokenId");

-- CreateIndex
CREATE INDEX "consultations_doctorId_status_idx" ON "consultations"("doctorId", "status");

-- CreateIndex
CREATE INDEX "consultations_patientId_idx" ON "consultations"("patientId");

-- CreateIndex
CREATE INDEX "prescription_items_prescriptionId_idx" ON "prescription_items"("prescriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_signatures_doctorId_key" ON "doctor_signatures"("doctorId");

-- CreateIndex
CREATE INDEX "medical_records_doctorId_idx" ON "medical_records"("doctorId");

-- CreateIndex
CREATE INDEX "prescriptions_consultationId_idx" ON "prescriptions"("consultationId");

-- CreateIndex
CREATE INDEX "prescriptions_status_idx" ON "prescriptions"("status");

-- AddForeignKey
ALTER TABLE "doctor_availability" ADD CONSTRAINT "doctor_availability_clinicDoctorId_fkey" FOREIGN KEY ("clinicDoctorId") REFERENCES "clinic_doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_leaves" ADD CONSTRAINT "doctor_leaves_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_leaves" ADD CONSTRAINT "doctor_leaves_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_sessions" ADD CONSTRAINT "doctor_sessions_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_sessions" ADD CONSTRAINT "doctor_sessions_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_tokens" ADD CONSTRAINT "queue_tokens_doctorSessionId_fkey" FOREIGN KEY ("doctorSessionId") REFERENCES "doctor_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_tokens" ADD CONSTRAINT "queue_tokens_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_tokens" ADD CONSTRAINT "queue_tokens_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "queue_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_signatures" ADD CONSTRAINT "doctor_signatures_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
