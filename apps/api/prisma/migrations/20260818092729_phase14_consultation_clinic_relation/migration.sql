-- CreateIndex
CREATE INDEX "consultations_clinicId_followUpDate_idx" ON "consultations"("clinicId", "followUpDate");

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
