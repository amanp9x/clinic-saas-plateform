-- CreateEnum
CREATE TYPE "ClinicOperatingStatus" AS ENUM ('OPEN', 'CLOSED', 'TEMPORARILY_CLOSED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ClinicVerificationStatus" AS ENUM ('PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ClinicDocumentType" AS ENUM ('REGISTRATION_CERTIFICATE', 'LICENSE', 'TAX_DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ClinicDocumentStatus" AS ENUM ('UPLOADED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ClinicDoctorStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ConsultationType" AS ENUM ('IN_CLINIC', 'ONLINE', 'FOLLOW_UP', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "ClinicResourceType" AS ENUM ('CONSULTATION_ROOM', 'PROCEDURE_ROOM', 'OTHER');

-- CreateEnum
CREATE TYPE "ClinicResourceStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "StaffInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "PatientDataVisibility" AS ENUM ('LIMITED', 'FULL');

-- AlterTable
ALTER TABLE "clinic_doctors" ADD COLUMN     "consultationTypes" "ConsultationType"[] DEFAULT ARRAY['IN_CLINIC']::"ConsultationType"[],
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "endDate" DATE,
ADD COLUMN     "queueEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "startDate" DATE,
ADD COLUMN     "status" "ClinicDoctorStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "clinics" ADD COLUMN     "accessibilityInfo" TEXT,
ADD COLUMN     "alternatePhone" TEXT,
ADD COLUMN     "clinicType" TEXT,
ADD COLUMN     "coverImageUrl" TEXT,
ADD COLUMN     "establishedYear" INTEGER,
ADD COLUMN     "facebookUrl" TEXT,
ADD COLUMN     "facilities" TEXT[],
ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "languages" TEXT[],
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "status" "ClinicOperatingStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "statusReason" TEXT,
ADD COLUMN     "statusUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "verificationNotes" TEXT,
ADD COLUMN     "verificationStatus" "ClinicVerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "verificationSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "clinic_documents" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "type" "ClinicDocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "status" "ClinicDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_services" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "departmentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "taxApplicable" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_working_hours" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_working_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_working_hours_sessions" (
    "id" TEXT NOT NULL,
    "workingHoursId" TEXT NOT NULL,
    "startTime" TIME NOT NULL,
    "endTime" TIME NOT NULL,

    CONSTRAINT "clinic_working_hours_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_holidays" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isFullDay" BOOLEAN NOT NULL DEFAULT true,
    "startTime" TIME,
    "endTime" TIME,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_resources" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ClinicResourceType" NOT NULL,
    "code" TEXT,
    "floor" TEXT,
    "capacity" INTEGER,
    "status" "ClinicResourceStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_invitations" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "title" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "token" TEXT NOT NULL,
    "status" "StaffInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedByUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_settings" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "defaultConsultationDurationMinutes" INTEGER NOT NULL DEFAULT 15,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
    "cancellationPolicy" TEXT,
    "noShowPolicy" TEXT,
    "queueEnabled" BOOLEAN NOT NULL DEFAULT true,
    "tokenPrefix" TEXT,
    "startingTokenNumber" INTEGER NOT NULL DEFAULT 1,
    "dailyTokenReset" BOOLEAN NOT NULL DEFAULT true,
    "priorityQueueEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emergencyPriorityEnabled" BOOLEAN NOT NULL DEFAULT true,
    "appointmentNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "queueNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "delayNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderMinutesBefore" INTEGER DEFAULT 60,
    "patientDataVisibility" "PatientDataVisibility" NOT NULL DEFAULT 'LIMITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clinic_documents_clinicId_type_idx" ON "clinic_documents"("clinicId", "type");

-- CreateIndex
CREATE INDEX "departments_clinicId_isActive_idx" ON "departments"("clinicId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "departments_clinicId_name_key" ON "departments"("clinicId", "name");

-- CreateIndex
CREATE INDEX "clinic_services_clinicId_isActive_idx" ON "clinic_services"("clinicId", "isActive");

-- CreateIndex
CREATE INDEX "clinic_services_departmentId_idx" ON "clinic_services"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_services_clinicId_name_key" ON "clinic_services"("clinicId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_working_hours_clinicId_weekday_key" ON "clinic_working_hours"("clinicId", "weekday");

-- CreateIndex
CREATE INDEX "clinic_working_hours_sessions_workingHoursId_idx" ON "clinic_working_hours_sessions"("workingHoursId");

-- CreateIndex
CREATE INDEX "clinic_holidays_clinicId_date_idx" ON "clinic_holidays"("clinicId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_holidays_clinicId_date_key" ON "clinic_holidays"("clinicId", "date");

-- CreateIndex
CREATE INDEX "clinic_resources_clinicId_type_idx" ON "clinic_resources"("clinicId", "type");

-- CreateIndex
CREATE INDEX "clinic_resources_clinicId_status_idx" ON "clinic_resources"("clinicId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "staff_invitations_token_key" ON "staff_invitations"("token");

-- CreateIndex
CREATE INDEX "staff_invitations_clinicId_email_idx" ON "staff_invitations"("clinicId", "email");

-- CreateIndex
CREATE INDEX "staff_invitations_clinicId_status_idx" ON "staff_invitations"("clinicId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_settings_clinicId_key" ON "clinic_settings"("clinicId");

-- CreateIndex
CREATE INDEX "clinic_doctors_departmentId_idx" ON "clinic_doctors"("departmentId");

-- AddForeignKey
ALTER TABLE "clinic_doctors" ADD CONSTRAINT "clinic_doctors_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_documents" ADD CONSTRAINT "clinic_documents_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_documents" ADD CONSTRAINT "clinic_documents_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_services" ADD CONSTRAINT "clinic_services_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_services" ADD CONSTRAINT "clinic_services_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_working_hours" ADD CONSTRAINT "clinic_working_hours_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_working_hours_sessions" ADD CONSTRAINT "clinic_working_hours_sessions_workingHoursId_fkey" FOREIGN KEY ("workingHoursId") REFERENCES "clinic_working_hours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_holidays" ADD CONSTRAINT "clinic_holidays_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_resources" ADD CONSTRAINT "clinic_resources_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_settings" ADD CONSTRAINT "clinic_settings_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
