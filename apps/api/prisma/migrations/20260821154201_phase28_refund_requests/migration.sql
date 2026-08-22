-- CreateEnum
CREATE TYPE "RefundRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_REFUND_REQUEST_REJECTED';

-- CreateTable
CREATE TABLE "refund_requests" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "amount" DECIMAL(10,2),
    "reason" TEXT NOT NULL,
    "status" "RefundRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "respondedByUserId" TEXT,
    "respondedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "refund_requests_paymentId_status_idx" ON "refund_requests"("paymentId", "status");

-- CreateIndex
CREATE INDEX "refund_requests_clinicId_status_idx" ON "refund_requests"("clinicId", "status");

-- CreateIndex
CREATE INDEX "refund_requests_patientId_idx" ON "refund_requests"("patientId");

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
