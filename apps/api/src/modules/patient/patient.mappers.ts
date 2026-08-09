import type { Patient, PatientAddress, User } from '@prisma/client';
import type { PatientAddressDto, PatientProfileDto } from '@clinic/shared';

export function toAddressDto(address: PatientAddress): PatientAddressDto {
  return {
    id: address.id,
    label: address.label,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
    isDefault: address.isDefault,
  };
}

export function toProfileDto(
  patient: Patient & { user: User; addresses: PatientAddress[] },
): PatientProfileDto {
  return {
    id: patient.id,
    email: patient.user.email,
    phone: patient.user.phone,
    isEmailVerified: patient.user.isEmailVerified,
    isMobileVerified: patient.user.isMobileVerified,
    fullName: patient.fullName,
    profileImageUrl: patient.profileImageUrl,
    dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.toISOString() : null,
    gender: patient.gender,
    bloodGroup: patient.bloodGroup,
    allergies: patient.allergies,
    medicalConditions: patient.medicalConditions,
    emergencyName: patient.emergencyName,
    emergencyPhone: patient.emergencyPhone,
    addresses: patient.addresses.map(toAddressDto),
  };
}
