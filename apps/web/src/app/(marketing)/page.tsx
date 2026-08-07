import type { Metadata } from 'next';
import {
  getArticles,
  getCities,
  getSpecializations,
  getTestimonials,
  searchClinics,
  searchDoctors,
  searchHospitals,
} from '@/lib/catalog-api';
import { HeroSection } from '@/components/marketing/sections/hero-section';
import { SmartSearchSection } from '@/components/marketing/sections/smart-search-section';
import { SpecialtiesSection } from '@/components/marketing/sections/specialties-section';
import { FeaturedDoctorsSection } from '@/components/marketing/sections/featured-doctors-section';
import { FeaturedClinicsSection } from '@/components/marketing/sections/featured-clinics-section';
import { FeaturedHospitalsSection } from '@/components/marketing/sections/featured-hospitals-section';
import { WhyChooseUsSection } from '@/components/marketing/sections/why-choose-us-section';
import { LiveQueueShowcaseSection } from '@/components/marketing/sections/live-queue-showcase-section';
import { TestimonialsSection } from '@/components/marketing/sections/testimonials-section';
import { ArticlesSection } from '@/components/marketing/sections/articles-section';
import { DownloadAppSection } from '@/components/marketing/sections/download-app-section';

export const metadata: Metadata = {
  title: 'Clinic SaaS Platform — Find Doctors, Clinics & Hospitals Near You',
  description:
    'Search verified doctors, clinics, and hospitals. Get real-time queue and delay updates so you always know how long the wait really is.',
};

export default async function HomePage() {
  const [specializations, cities, doctors, clinics, hospitals, testimonials, articles] =
    await Promise.all([
      getSpecializations(),
      getCities(),
      searchDoctors({ sort: 'rating', limit: 4 }),
      searchClinics({ limit: 3 }),
      searchHospitals({ limit: 3 }),
      getTestimonials(6),
      getArticles(6),
    ]);

  return (
    <>
      <HeroSection />
      <SmartSearchSection specializations={specializations} cities={cities} />
      <SpecialtiesSection specializations={specializations.slice(0, 12)} />
      <FeaturedDoctorsSection doctors={doctors.items} />
      <FeaturedClinicsSection clinics={clinics.items} />
      <FeaturedHospitalsSection hospitals={hospitals.items} />
      <WhyChooseUsSection />
      <LiveQueueShowcaseSection />
      <TestimonialsSection testimonials={testimonials} />
      <ArticlesSection articles={articles} />
      <DownloadAppSection />
    </>
  );
}
