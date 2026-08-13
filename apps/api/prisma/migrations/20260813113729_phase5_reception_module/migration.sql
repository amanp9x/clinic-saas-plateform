-- CreateEnum
CREATE TYPE "TokenPriority" AS ENUM ('NORMAL', 'FOLLOW_UP', 'URGENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'WAIVED');

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "paymentStatus" "PaymentStatus";

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "clinicId" TEXT;

-- AlterTable
ALTER TABLE "clinic_staff_members" ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "doctor_sessions" ADD COLUMN     "pauseReason" TEXT;

-- AlterTable
ALTER TABLE "queue_tokens" ADD COLUMN     "priority" "TokenPriority" NOT NULL DEFAULT 'NORMAL';

-- CreateIndex
CREATE INDEX "audit_logs_clinicId_createdAt_idx" ON "audit_logs"("clinicId", "createdAt");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
