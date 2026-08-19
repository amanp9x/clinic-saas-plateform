-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CLINIC_DOCUMENT_EXPIRING';

-- AlterTable
ALTER TABLE "clinic_documents" ADD COLUMN     "expiryDate" DATE;

-- CreateIndex
CREATE INDEX "clinic_documents_expiryDate_idx" ON "clinic_documents"("expiryDate");
