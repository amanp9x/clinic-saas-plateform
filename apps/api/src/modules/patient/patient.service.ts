import { OtpPurpose } from '@prisma/client';
import type {
  AddressInput,
  ChangeEmailConfirmInput,
  ChangeMobileConfirmInput,
  DeleteAccountInput,
  UpdateProfileInput,
} from '@clinic/shared';
import { patientRepository } from './patient.repository.js';
import { toAddressDto, toProfileDto } from './patient.mappers.js';
import { authRepository } from '../auth/auth.repository.js';
import { otpService } from '../auth/otp.service.js';
import { sessionService } from '../auth/session.service.js';
import { verifyPassword } from '../../utils/password.js';
import { ConflictError, InvalidCredentialsError, NotFoundError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { saveUploadedFile, deleteUploadedFile, relativePathFromUrl } from '../../services/storage.service.js';

async function getPatientOrThrow(userId: string) {
  const patient = await patientRepository.findByUserId(userId);
  if (!patient) {
    throw new NotFoundError('Patient profile');
  }
  return patient;
}

function toNullable(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value === '' ? null : value;
}

export const patientService = {
  async getProfile(userId: string) {
    const patient = await getPatientOrThrow(userId);
    return toProfileDto(patient);
  },

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const patient = await getPatientOrThrow(userId);
    const updated = await patientRepository.updateProfile(patient.id, {
      fullName: input.fullName,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : toNullable(input.dateOfBirth),
      gender: input.gender,
      bloodGroup: toNullable(input.bloodGroup),
      allergies: input.allergies,
      medicalConditions: input.medicalConditions,
      emergencyName: toNullable(input.emergencyName),
      emergencyPhone: toNullable(input.emergencyPhone),
    });
    recordAuditLog({ actorUserId: userId, action: 'patient.profile_updated', entityType: 'Patient', entityId: updated.id });
    return patientService.getProfile(userId);
  },

  async uploadProfilePhoto(userId: string, file: { buffer: Buffer; originalname: string }) {
    const patient = await getPatientOrThrow(userId);

    const previousUrl = patient.profileImageUrl;
    const { url } = await saveUploadedFile({
      buffer: file.buffer,
      originalName: file.originalname,
      subdirectory: 'avatars',
    });

    await patientRepository.updateProfileImage(patient.id, url);

    if (previousUrl) {
      const relative = relativePathFromUrl(previousUrl);
      if (relative) await deleteUploadedFile(relative).catch(() => undefined);
    }

    recordAuditLog({ actorUserId: userId, action: 'patient.photo_updated', entityType: 'Patient', entityId: patient.id });
    return { profileImageUrl: url };
  },

  async removeProfilePhoto(userId: string) {
    const patient = await getPatientOrThrow(userId);
    if (patient.profileImageUrl) {
      const relative = relativePathFromUrl(patient.profileImageUrl);
      if (relative) await deleteUploadedFile(relative).catch(() => undefined);
    }
    await patientRepository.updateProfileImage(patient.id, null);
  },

  async listAddresses(userId: string) {
    const patient = await getPatientOrThrow(userId);
    const addresses = await patientRepository.listAddresses(patient.id);
    return addresses.map(toAddressDto);
  },

  async createAddress(userId: string, input: AddressInput) {
    const patient = await getPatientOrThrow(userId);
    if (input.isDefault) {
      await patientRepository.clearDefaultAddresses(patient.id);
    }
    const address = await patientRepository.createAddress(patient.id, {
      label: input.label,
      addressLine1: input.addressLine1,
      addressLine2: toNullable(input.addressLine2) ?? undefined,
      city: input.city,
      state: toNullable(input.state) ?? undefined,
      postalCode: toNullable(input.postalCode) ?? undefined,
      country: input.country,
      isDefault: input.isDefault,
    });
    return toAddressDto(address);
  },

  async updateAddress(userId: string, addressId: string, input: AddressInput) {
    const patient = await getPatientOrThrow(userId);
    const existing = await patientRepository.findAddress(addressId, patient.id);
    if (!existing) {
      throw new NotFoundError('Address');
    }
    if (input.isDefault) {
      await patientRepository.clearDefaultAddresses(patient.id, addressId);
    }
    const address = await patientRepository.updateAddress(addressId, {
      label: input.label,
      addressLine1: input.addressLine1,
      addressLine2: toNullable(input.addressLine2),
      city: input.city,
      state: toNullable(input.state),
      postalCode: toNullable(input.postalCode),
      country: input.country,
      isDefault: input.isDefault,
    });
    return toAddressDto(address);
  },

  async deleteAddress(userId: string, addressId: string) {
    const patient = await getPatientOrThrow(userId);
    const existing = await patientRepository.findAddress(addressId, patient.id);
    if (!existing) {
      throw new NotFoundError('Address');
    }
    await patientRepository.deleteAddress(addressId);
  },

  async requestEmailChange(userId: string, newEmail: string) {
    const existing = await authRepository.findUserByEmail(newEmail);
    if (existing && existing.id !== userId) {
      throw new ConflictError('That email is already in use by another account');
    }
    await otpService.request(newEmail, OtpPurpose.EMAIL_VERIFICATION);
  },

  async confirmEmailChange(userId: string, input: ChangeEmailConfirmInput) {
    const existing = await authRepository.findUserByEmail(input.newEmail);
    if (existing && existing.id !== userId) {
      throw new ConflictError('That email is already in use by another account');
    }
    await otpService.verify(input.newEmail, OtpPurpose.EMAIL_VERIFICATION, input.code);
    await authRepository.updateEmail(userId, input.newEmail);
    recordAuditLog({ actorUserId: userId, action: 'patient.email_changed', entityType: 'User', entityId: userId });
  },

  async requestMobileChange(userId: string, newPhone: string) {
    const existing = await authRepository.findUserByPhone(newPhone);
    if (existing && existing.id !== userId) {
      throw new ConflictError('That phone number is already in use by another account');
    }
    await otpService.request(newPhone, OtpPurpose.MOBILE_VERIFICATION);
  },

  async confirmMobileChange(userId: string, input: ChangeMobileConfirmInput) {
    const existing = await authRepository.findUserByPhone(input.newPhone);
    if (existing && existing.id !== userId) {
      throw new ConflictError('That phone number is already in use by another account');
    }
    await otpService.verify(input.newPhone, OtpPurpose.MOBILE_VERIFICATION, input.code);
    await authRepository.updatePhone(userId, input.newPhone);
    recordAuditLog({ actorUserId: userId, action: 'patient.mobile_changed', entityType: 'User', entityId: userId });
  },

  async deleteAccount(userId: string, input: DeleteAccountInput) {
    const user = await authRepository.findUserById(userId);
    if (!user?.passwordHash) {
      throw new InvalidCredentialsError('Password confirmation is not available for this account');
    }
    const isValid = await verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
      throw new InvalidCredentialsError('Incorrect password');
    }

    await authRepository.deactivate(userId);
    await sessionService.revokeAllForUser(userId, 'account_deleted');
    recordAuditLog({
      actorUserId: userId,
      action: 'patient.account_deleted',
      entityType: 'User',
      entityId: userId,
      metadata: input.reason ? { reason: input.reason } : undefined,
    });
  },
};
