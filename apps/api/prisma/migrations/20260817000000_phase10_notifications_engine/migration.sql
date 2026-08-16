-- CreateEnum
CREATE TYPE "NotificationTier" AS ENUM ('TRANSACTIONAL', 'SECURITY', 'OPTIONAL');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'APPOINTMENT_BOOKED';
ALTER TYPE "NotificationType" ADD VALUE 'APPOINTMENT_CONFIRMED';
ALTER TYPE "NotificationType" ADD VALUE 'APPOINTMENT_RESCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE 'APPOINTMENT_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE 'APPOINTMENT_CHECKED_IN';
ALTER TYPE "NotificationType" ADD VALUE 'APPOINTMENT_NO_SHOW';
ALTER TYPE "NotificationType" ADD VALUE 'APPOINTMENT_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'APPOINTMENT_STARTING_SOON';
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_PENDING';
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_SUCCESS';
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_FAILED';
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_REFUNDED';
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_REFUND_PENDING';
ALTER TYPE "NotificationType" ADD VALUE 'QUEUE_CHECKED_IN';
ALTER TYPE "NotificationType" ADD VALUE 'PATIENT_CALLED';
ALTER TYPE "NotificationType" ADD VALUE 'PATIENT_SKIPPED';
ALTER TYPE "NotificationType" ADD VALUE 'QUEUE_DELAY_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'DOCTOR_DELAYED';
ALTER TYPE "NotificationType" ADD VALUE 'DOCTOR_ON_TIME';
ALTER TYPE "NotificationType" ADD VALUE 'QUEUE_PAUSED';
ALTER TYPE "NotificationType" ADD VALUE 'QUEUE_RESUMED';
ALTER TYPE "NotificationType" ADD VALUE 'CONSULTATION_STARTED';
ALTER TYPE "NotificationType" ADD VALUE 'CONSULTATION_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE 'DOCTOR_STATUS_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE 'CLINIC_ANNOUNCEMENT';
ALTER TYPE "NotificationType" ADD VALUE 'REVIEW_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'REVIEW_RESPONSE';
ALTER TYPE "NotificationType" ADD VALUE 'SECURITY_LOGIN';
ALTER TYPE "NotificationType" ADD VALUE 'SECURITY_PASSWORD_CHANGED';

-- AlterTable
ALTER TABLE "notification_preferences" DROP COLUMN "appointmentUpdates",
DROP COLUMN "channel",
DROP COLUMN "prescriptionReady",
DROP COLUMN "queueUpdates",
DROP COLUMN "reportReady",
ADD COLUMN     "announcementEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "announcementInApp" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "appointmentEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "appointmentInApp" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "paymentEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "paymentInApp" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "prescriptionEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "prescriptionInApp" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "queueEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "queueInApp" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "actionUrl" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "notificationKey" TEXT,
ADD COLUMN     "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL';

-- DropEnum
DROP TYPE "NotificationChannel";

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_deliveries_notificationId_idx" ON "notification_deliveries"("notificationId");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_idx" ON "notification_deliveries"("status");

-- CreateIndex
CREATE INDEX "notification_deliveries_providerMessageId_idx" ON "notification_deliveries"("providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_notificationKey_key" ON "notifications"("notificationKey");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_expiresAt_idx" ON "notifications"("expiresAt");

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

