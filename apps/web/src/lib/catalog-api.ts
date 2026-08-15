import 'server-only';
import type {
  ApiResponse,
  ArticleDto,
  ClinicDetail,
  ClinicSummary,
  DoctorDetail,
  DoctorSummary,
  HospitalSummary,
  PaginatedResult,
  SpecializationSummary,
  TestimonialDto,
} from '@clinic/shared';
import { clientEnv } from './env';

type QueryValue = string | number | boolean | string[] | undefined;

function toQueryString(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    if (Array.isArray(value)) {
      for (const v of value) search.append(key, v);
    } else {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

class CatalogFetchError extends Error {}

/** Server-only fetcher for the public catalog API. Not the same client used by authenticated
 * TanStack Query hooks — these are unauthenticated, cache-friendly Server Component reads. */
async function catalogFetch<T>(
  path: string,
  params: Record<string, QueryValue> = {},
  revalidateSeconds = 60,
): Promise<T> {
  const url = `${clientEnv.apiUrl}${path}${toQueryString(params)}`;
  const res = await fetch(url, { next: { revalidate: revalidateSeconds } });
  const json = (await res.json()) as ApiResponse<T>;

  if (!json.success) {
    throw new CatalogFetchError(json.error.message);
  }
  return json.data;
}

export function getSpecializations() {
  return catalogFetch<{ specializations: SpecializationSummary[] }>(
    '/api/v1/catalog/specializations',
    {},
    300,
  ).then((d) => d.specializations);
}

export function getCities() {
  return catalogFetch<{ cities: string[] }>('/api/v1/catalog/cities', {}, 300).then(
    (d) => d.cities,
  );
}

export interface DoctorSearchParams {
  [key: string]: QueryValue;
  query?: string;
  city?: string;
  area?: string;
  clinicId?: string;
  specializationSlug?: string;
  gender?: string;
  minExperience?: number;
  maxFee?: number;
  minRating?: number;
  availableToday?: boolean;
  availableThisWeek?: boolean;
  onlineConsultation?: boolean;
  consultationType?: string;
  languages?: string[];
  sort?: string;
  page?: number;
  limit?: number;
}

export function searchDoctors(params: DoctorSearchParams) {
  return catalogFetch<PaginatedResult<DoctorSummary>>('/api/v1/catalog/doctors', params, 30);
}

export async function getDoctorBySlug(
  slug: string,
): Promise<{ doctor: DoctorDetail; similarDoctors: DoctorSummary[] } | null> {
  try {
    return await catalogFetch<{ doctor: DoctorDetail; similarDoctors: DoctorSummary[] }>(
      `/api/v1/catalog/doctors/${encodeURIComponent(slug)}`,
      {},
      30,
    );
  } catch {
    return null;
  }
}

export interface FacilitySearchParams {
  [key: string]: QueryValue;
  query?: string;
  city?: string;
  page?: number;
  limit?: number;
}

export interface ClinicSearchParams extends FacilitySearchParams {
  area?: string;
  minRating?: number;
  availableToday?: boolean;
  maxFee?: number;
  consultationType?: string;
  service?: string;
}

export function searchClinics(params: ClinicSearchParams) {
  return catalogFetch<PaginatedResult<ClinicSummary>>('/api/v1/catalog/clinics', params, 60);
}

export async function getClinicBySlug(slug: string): Promise<ClinicDetail | null> {
  try {
    return await catalogFetch<ClinicDetail>(`/api/v1/catalog/clinics/${encodeURIComponent(slug)}`, {}, 30);
  } catch {
    return null;
  }
}

export function searchHospitals(params: FacilitySearchParams) {
  return catalogFetch<PaginatedResult<HospitalSummary>>('/api/v1/catalog/hospitals', params, 60);
}

export async function getSpecializationBySlug(slug: string): Promise<SpecializationSummary | null> {
  try {
    return await catalogFetch<SpecializationSummary>(
      `/api/v1/catalog/specializations/${encodeURIComponent(slug)}`,
      {},
      300,
    );
  } catch {
    return null;
  }
}

export function getTestimonials(limit = 6) {
  return catalogFetch<{ testimonials: TestimonialDto[] }>(
    '/api/v1/catalog/testimonials',
    { limit },
    300,
  ).then((d) => d.testimonials);
}

export function getArticles(limit = 6) {
  return catalogFetch<{ articles: ArticleDto[] }>('/api/v1/catalog/articles', { limit }, 300).then(
    (d) => d.articles,
  );
}
