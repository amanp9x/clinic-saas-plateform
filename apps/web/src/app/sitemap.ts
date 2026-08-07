import type { MetadataRoute } from 'next';
import { clientEnv } from '@/lib/env';
import { searchDoctors } from '@/lib/catalog-api';

const STATIC_ROUTES = [
  '',
  '/doctors',
  '/clinics',
  '/hospitals',
  '/about',
  '/contact',
  '/faq',
  '/privacy-policy',
  '/terms',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${clientEnv.siteUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.7,
  }));

  let doctorEntries: MetadataRoute.Sitemap = [];
  try {
    const doctors = await searchDoctors({ limit: 50, sort: 'rating' });
    doctorEntries = doctors.items.map((doctor) => ({
      url: `${clientEnv.siteUrl}/doctors/${doctor.slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.6,
    }));
  } catch {
    // API unreachable at build time — ship the static routes only rather than failing the build.
  }

  return [...staticEntries, ...doctorEntries];
}
