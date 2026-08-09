import type { Patient, User } from '@prisma/client';
import type { DoctorPatientProfileDto } from '@clinic/shared';
import { calculateAge } from '../../utils/age.js';

export function toDoctorPatientProfile(patient: Patient & { user: User }): DoctorPatientProfileDto {
  return {
    id: patient.id,
    fullName: patient.fullName,
    profileImageUrl: patient.profileImageUrl,
    dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.toISOString() : null,
    age: calculateAge(patient.dateOfBirth),
    gender: patient.gender,
    bloodGroup: patient.bloodGroup,
    allergies: patient.allergies,
    medicalConditions: patient.medicalConditions,
    phone: patient.user.phone,
    email: patient.user.email,
  };
}
