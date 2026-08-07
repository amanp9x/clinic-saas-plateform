import 'server-only';
import type {
  ApiResponse,
  ArticleDto,
  ClinicSummary,
  DoctorDetail,
  DoctorSummary,
  HospitalSummary,
  PaginatedResult,
  SpecializationSummary,
  TestimonialDto,
} from '@clinic/shared';
import { clientEnv } from './env';

type QueryValue = string | number | boolean | undefined;

function toQueryString(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
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
  specializationSlug?: string;
  gender?: string;
  minExperience?: number;
  maxFee?: number;
  minRating?: number;
  availableToday?: boolean;
  onlineConsultation?: boolean;
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

export function searchClinics(params: FacilitySearchParams) {
  return catalogFetch<PaginatedResult<ClinicSummary>>('/api/v1/catalog/clinics', params, 60);
}

export function searchHospitals(params: FacilitySearchParams) {
  return catalogFetch<PaginatedResult<HospitalSummary>>('/api/v1/catalog/hospitals', params, 60);
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
