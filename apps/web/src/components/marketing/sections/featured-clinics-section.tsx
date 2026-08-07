import Link from 'next/link';
import type { ClinicSummary } from '@clinic/shared';
import { SectionHeading } from '../section-heading';
import { ClinicCard } from '../clinic-card';
import { Button } from '@/components/ui/button';

export function FeaturedClinicsSection({ clinics }: { clinics: ClinicSummary[] }) {
  if (clinics.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-16">
      <SectionHeading
        title="Featured clinics"
        action={
          <Button variant="outline" render={<Link href="/clinics" />}>
            View all clinics
          </Button>
        }
      />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {clinics.map((clinic) => (
          <ClinicCard key={clinic.id} clinic={clinic} />
        ))}
      </div>
    </section>
  );
}
