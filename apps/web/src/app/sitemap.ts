import type { MetadataRoute } from 'next';
import { clientEnv } from '@/lib/env';
import { getSpecializations, searchClinics, searchDoctors } from '@/lib/catalog-api';

const STATIC_ROUTES = [
  '',
  '/doctors',
  '/clinics',
  '/hospitals',
  '/specializations',
  '/about',
  '/contact',
  '/faq',
  '/privacy-policy',
  '/terms',
];

const MAX_DOCTOR_PAGES = 10;
const MAX_CLINIC_PAGES = 10;
const PAGE_LIMIT = 50;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${clientEnv.siteUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.7,
  }));

  let doctorEntries: MetadataRoute.Sitemap = [];
  try {
    for (let page = 1; page <= MAX_DOCTOR_PAGES; page++) {
      const doctors = await searchDoctors({ limit: PAGE_LIMIT, sort: 'rating', page });
      doctorEntries = doctorEntries.concat(
        doctors.items.map((doctor) => ({
          url: `${clientEnv.siteUrl}/doctors/${doctor.slug}`,
          lastModified: new Date(),
          changeFrequency: 'daily' as const,
          priority: 0.6,
        })),
      );
      if (page >= doctors.totalPages) break;
    }
  } catch {
    // API unreachable at build time — ship the static routes only rather than failing the build.
  }

  let clinicEntries: MetadataRoute.Sitemap = [];
  try {
    for (let page = 1; page <= MAX_CLINIC_PAGES; page++) {
      const clinics = await searchClinics({ limit: PAGE_LIMIT, page });
      clinicEntries = clinicEntries.concat(
        clinics.items.map((clinic) => ({
          url: `${clientEnv.siteUrl}/clinics/${clinic.slug}`,
          lastModified: new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        })),
      );
      if (page >= clinics.totalPages) break;
    }
  } catch {
    // API unreachable at build time — ship what we have rather than failing the build.
  }

  let specializationEntries: MetadataRoute.Sitemap = [];
  try {
    const specializations = await getSpecializations();
    specializationEntries = specializations.map((s) => ({
      url: `${clientEnv.siteUrl}/specializations/${s.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }));
  } catch {
    // API unreachable at build time — ship what we have rather than failing the build.
  }

  return [...staticEntries, ...doctorEntries, ...clinicEntries, ...specializationEntries];
}
