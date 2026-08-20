-- CreateEnum
CREATE TYPE "RefillRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- CreateTable
CREATE TABLE "prescription_refill_requests" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "status" "RefillRequestStatus" NOT NULL DEFAULT 'PENDING',
    "patientNote" TEXT,
    "doctorNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "respondedByUserId" TEXT,
    "issuedPrescriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescription_refill_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prescription_refill_requests_issuedPrescriptionId_key" ON "prescription_refill_requests"("issuedPrescriptionId");

-- CreateIndex
CREATE INDEX "prescription_refill_requests_patientId_status_idx" ON "prescription_refill_requests"("patientId", "status");

-- CreateIndex
CREATE INDEX "prescription_refill_requests_doctorId_status_idx" ON "prescription_refill_requests"("doctorId", "status");

-- CreateIndex
CREATE INDEX "prescription_refill_requests_prescriptionId_idx" ON "prescription_refill_requests"("prescriptionId");

-- AddForeignKey
ALTER TABLE "prescription_refill_requests" ADD CONSTRAINT "prescription_refill_requests_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_refill_requests" ADD CONSTRAINT "prescription_refill_requests_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_refill_requests" ADD CONSTRAINT "prescription_refill_requests_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
