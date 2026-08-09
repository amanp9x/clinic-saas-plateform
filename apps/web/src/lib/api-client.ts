import type { ApiErrorResponse, ApiResponse } from '@clinic/shared';
import { clientEnv } from './env';
import { tokenStore } from './token-store';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuthRetry?: boolean;
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  refreshPromise ??= (async () => {
    try {
      const res = await fetch(`${clientEnv.apiUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;
      const json = (await res.json()) as ApiResponse<{ accessToken: string }>;
      if (!json.success) return false;
      tokenStore.set(json.data.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuthRetry, headers, ...rest } = options;
  const accessToken = tokenStore.get();
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const res = await fetch(`${clientEnv.apiUrl}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      // FormData sets its own multipart boundary — never override its Content-Type.
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !skipAuthRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetch<T>(path, { ...options, skipAuthRetry: true });
    }
  }

  const json = (await res.json()) as ApiResponse<T>;

  if (!json.success) {
    const err = json as ApiErrorResponse;
    throw new ApiError(err.error.code, err.error.message, res.status, err.error.details);
  }

  return json.data;
}
