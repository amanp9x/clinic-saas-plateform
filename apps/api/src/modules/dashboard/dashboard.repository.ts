import { LabReportStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';

export const dashboardRepository = {
  async counts(patientId: string, userId: string) {
    const [medicalRecordsCount, prescriptionsCount, labReportsPendingCount, labReportsReadyCount, unreadNotificationsCount] =
      await Promise.all([
        prisma.medicalRecord.count({ where: { patientId } }),
        prisma.prescription.count({ where: { patientId } }),
        prisma.labReport.count({ where: { patientId, status: LabReportStatus.PENDING } }),
        prisma.labReport.count({ where: { patientId, status: LabReportStatus.READY } }),
        prisma.notification.count({ where: { userId, isRead: false } }),
      ]);

    return {
      medicalRecordsCount,
      prescriptionsCount,
      labReportsPendingCount,
      labReportsReadyCount,
      unreadNotificationsCount,
    };
  },
};
