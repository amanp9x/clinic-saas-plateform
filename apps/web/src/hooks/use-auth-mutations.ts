'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  AuthenticatedUser,
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  OtpRequestInput,
  OtpVerifyInput,
  RegisterInput,
  ResendEmailVerificationInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';
import { tokenStore } from '@/lib/token-store';
import { AUTH_QUERY_KEY } from './use-auth';

interface AuthPayload {
  user: AuthenticatedUser;
  accessToken: string;
  expiresIn: number;
  isNewUser?: boolean;
}

/** Every endpoint that establishes a session (register/login/otp-verify/refresh) shares this. */
function useAuthPayloadMutation<TInput>(path: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TInput) => apiFetch<AuthPayload>(path, { method: 'POST', body: input }),
    onSuccess: (data) => {
      tokenStore.set(data.accessToken);
      queryClient.setQueryData(AUTH_QUERY_KEY, data.user);
    },
  });
}

export function useRegister() {
  return useAuthPayloadMutation<RegisterInput>('/api/v1/auth/register');
}

export function useLogin() {
  return useAuthPayloadMutation<LoginInput>('/api/v1/auth/login');
}

export function useVerifyOtpLogin() {
  return useAuthPayloadMutation<OtpVerifyInput>('/api/v1/auth/otp/verify');
}

export function useRequestOtpLogin() {
  return useMutation({
    mutationFn: (input: OtpRequestInput) =>
      apiFetch<null>('/api/v1/auth/otp/request', { method: 'POST', body: input }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<null>('/api/v1/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      tokenStore.clear();
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
    },
  });
}

export function useLogoutAllDevices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ sessionsRevoked: number }>('/api/v1/auth/logout-all', { method: 'POST' }),
    onSuccess: () => {
      tokenStore.clear();
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      apiFetch<null>('/api/v1/auth/password/change', { method: 'POST', body: input }),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: ForgotPasswordInput) =>
      apiFetch<null>('/api/v1/auth/password/forgot', { method: 'POST', body: input }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) =>
      apiFetch<null>('/api/v1/auth/password/reset', { method: 'POST', body: input }),
  });
}

export function useVerifyEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: VerifyEmailInput) =>
      apiFetch<null>('/api/v1/auth/email/verify', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY }),
  });
}

export function useResendEmailVerification() {
  return useMutation({
    mutationFn: (input: ResendEmailVerificationInput) =>
      apiFetch<null>('/api/v1/auth/email/resend', { method: 'POST', body: input }),
  });
}
