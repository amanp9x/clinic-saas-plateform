-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('ACTIVE', 'NOTIFIED', 'FULFILLED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'WAITLIST_SLOT_AVAILABLE';

-- AlterTable
ALTER TABLE "doctor_reviews" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "targetDate" DATE NOT NULL,
    "consultationType" "ConsultationType",
    "notes" TEXT,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'ACTIVE',
    "notifiedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "fulfilledAppointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_entries_fulfilledAppointmentId_key" ON "waitlist_entries"("fulfilledAppointmentId");

-- CreateIndex
CREATE INDEX "waitlist_entries_doctorId_clinicId_targetDate_status_idx" ON "waitlist_entries"("doctorId", "clinicId", "targetDate", "status");

-- CreateIndex
CREATE INDEX "waitlist_entries_patientId_status_idx" ON "waitlist_entries"("patientId", "status");

-- CreateIndex
CREATE INDEX "waitlist_entries_clinicId_status_idx" ON "waitlist_entries"("clinicId", "status");

-- Hand-added partial unique index (Phase 13): a Postgres partial unique index cannot be
-- expressed in the Prisma schema DSL. This is the actual, DB-enforced guarantee that a patient
-- can have at most one ACTIVE-or-NOTIFIED waitlist entry per (doctorId, clinicId, targetDate) —
-- CANCELLED/FULFILLED rows are excluded so the same patient can rejoin after cancelling or after
-- their entry is fulfilled. Mirrors the Phase 8 booking engine's own hand-added partial unique
-- index on "appointments" exactly. `prisma migrate diff`/`db pull` will permanently show this as
-- one line of drift — expected, not a bug.
CREATE UNIQUE INDEX "waitlist_entries_active_key"
  ON "waitlist_entries" ("patientId", "doctorId", "clinicId", "targetDate")
  WHERE "status" IN ('ACTIVE', 'NOTIFIED');

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_fulfilledAppointmentId_fkey" FOREIGN KEY ("fulfilledAppointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
