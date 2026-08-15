-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('PATIENT', 'RECEPTION', 'DOCTOR');

-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('NEW_CONSULTATION', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "SlotHoldStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'RELEASED');

-- AlterTable
-- bookingReference is added nullable first, backfilled for existing rows below, then locked to
-- NOT NULL — there are pre-existing appointment rows (seed/dev data) with no default value.
ALTER TABLE "appointments" ADD COLUMN     "appointmentType" "AppointmentType" NOT NULL DEFAULT 'NEW_CONSULTATION',
ADD COLUMN     "bookingReference" TEXT,
ADD COLUMN     "bookingSource" "BookingSource" NOT NULL DEFAULT 'PATIENT',
ADD COLUMN     "bufferMinutesAfter" INTEGER,
ADD COLUMN     "cancelSource" "BookingSource",
ADD COLUMN     "cancelledByUserId" TEXT,
ADD COLUMN     "consultationType" "ConsultationType" NOT NULL DEFAULT 'IN_CLINIC',
ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "previousScheduledAt" TIMESTAMP(3),
ADD COLUMN     "previousStatusBeforeCancel" "AppointmentStatus",
ADD COLUMN     "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rescheduleReason" TEXT,
ADD COLUMN     "rescheduledAt" TIMESTAMP(3),
ADD COLUMN     "rescheduledByUserId" TEXT;

-- Backfill a unique, human-readable-format reference for pre-existing rows (seed/dev data),
-- derived from the row's own already-unique id so no collision is possible across the backfill.
UPDATE "appointments"
SET "bookingReference" = 'APT-' || to_char("createdAt", 'YYYYMMDD') || '-' || upper(substr(replace(id::text, '-', ''), 1, 8))
WHERE "bookingReference" IS NULL;

ALTER TABLE "appointments" ALTER COLUMN "bookingReference" SET NOT NULL;

-- CreateTable
CREATE TABLE "slot_holds" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "patientId" TEXT NOT NULL,
    "heldByUserId" TEXT NOT NULL,
    "bookingSource" "BookingSource" NOT NULL,
    "consultationType" "ConsultationType" NOT NULL,
    "status" "SlotHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slot_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_slots" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT,
    "clinicId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "unblockedAt" TIMESTAMP(3),
    "unblockedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "slot_holds_expiresAt_status_idx" ON "slot_holds"("expiresAt", "status");

-- CreateIndex
CREATE INDEX "slot_holds_patientId_idx" ON "slot_holds"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "slot_holds_doctorId_clinicId_scheduledAt_key" ON "slot_holds"("doctorId", "clinicId", "scheduledAt");

-- CreateIndex
CREATE INDEX "blocked_slots_clinicId_startAt_idx" ON "blocked_slots"("clinicId", "startAt");

-- CreateIndex
CREATE INDEX "blocked_slots_doctorId_startAt_idx" ON "blocked_slots"("doctorId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_bookingReference_key" ON "appointments"("bookingReference");

-- CreateIndex
CREATE INDEX "appointments_clinicId_scheduledAt_idx" ON "appointments"("clinicId", "scheduledAt");

-- AddForeignKey
ALTER TABLE "slot_holds" ADD CONSTRAINT "slot_holds_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_holds" ADD CONSTRAINT "slot_holds_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_holds" ADD CONSTRAINT "slot_holds_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_slots" ADD CONSTRAINT "blocked_slots_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_slots" ADD CONSTRAINT "blocked_slots_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Double-booking guarantee (Phase 8): a partial unique index cannot be expressed in the Prisma
-- schema DSL. This is the actual, DB-enforced, unbypassable guarantee that two active
-- appointments can never share the same (doctorId, clinicId, scheduledAt) tuple. Cancelled/
-- no-show appointments are excluded so a slot can be rebooked after cancellation.
-- `prisma migrate diff`/`db pull` will permanently show this as one line of drift — expected.
CREATE UNIQUE INDEX "appointments_doctor_clinic_scheduled_active_key"
  ON "appointments" ("doctorId", "clinicId", "scheduledAt")
  WHERE "status" NOT IN ('CANCELLED', 'NO_SHOW');
