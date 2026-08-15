import { z } from 'zod';

export const favoriteDoctorParamSchema = z.object({
  doctorId: z.string().uuid(),
});

export const favoriteClinicParamSchema = z.object({
  clinicId: z.string().uuid(),
});
