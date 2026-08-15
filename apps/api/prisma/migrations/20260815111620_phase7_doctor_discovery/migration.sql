-- AlterTable
ALTER TABLE "clinics" ADD COLUMN     "area" TEXT;

-- AlterTable
ALTER TABLE "hospitals" ADD COLUMN     "area" TEXT;

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT,
    "clinicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "favorites_patientId_idx" ON "favorites"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_patientId_doctorId_key" ON "favorites"("patientId", "doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_patientId_clinicId_key" ON "favorites"("patientId", "clinicId");

-- CreateIndex
CREATE INDEX "clinics_city_area_idx" ON "clinics"("city", "area");

-- CreateIndex
CREATE INDEX "hospitals_city_area_idx" ON "hospitals"("city", "area");

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
