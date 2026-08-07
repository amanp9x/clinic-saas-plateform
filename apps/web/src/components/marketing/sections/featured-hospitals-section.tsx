import Link from 'next/link';
import type { HospitalSummary } from '@clinic/shared';
import { SectionHeading } from '../section-heading';
import { HospitalCard } from '../hospital-card';
import { Button } from '@/components/ui/button';

export function FeaturedHospitalsSection({ hospitals }: { hospitals: HospitalSummary[] }) {
  if (hospitals.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-16">
      <SectionHeading
        title="Featured hospitals"
        action={
          <Button variant="outline" render={<Link href="/hospitals" />}>
            View all hospitals
          </Button>
        }
      />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {hospitals.map((hospital) => (
          <HospitalCard key={hospital.id} hospital={hospital} />
        ))}
      </div>
    </section>
  );
}
