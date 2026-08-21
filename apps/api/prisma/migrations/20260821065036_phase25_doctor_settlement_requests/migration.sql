-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'PAID');

-- CreateTable
CREATE TABLE "settlement_requests" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "SettlementStatus" NOT NULL DEFAULT 'REQUESTED',
    "doctorNotes" TEXT,
    "respondedByUserId" TEXT,
    "respondedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "settlement_requests_doctorId_status_idx" ON "settlement_requests"("doctorId", "status");

-- CreateIndex
CREATE INDEX "settlement_requests_status_idx" ON "settlement_requests"("status");

-- AddForeignKey
ALTER TABLE "settlement_requests" ADD CONSTRAINT "settlement_requests_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-added: Prisma's schema DSL cannot express a partial unique index. This is the real,
-- DB-enforced guarantee that a doctor can never have more than one ACTIVE (REQUESTED/APPROVED)
-- settlement request at a time — same pattern as the Phase 8 booking engine's partial unique
-- index on "appointments" for double-booking prevention. `prisma migrate diff`/`db pull` will
-- permanently show this as one line of drift — expected, not a bug.
CREATE UNIQUE INDEX "settlement_requests_doctor_active_key"
  ON "settlement_requests" ("doctorId")
  WHERE "status" IN ('REQUESTED', 'APPROVED');
