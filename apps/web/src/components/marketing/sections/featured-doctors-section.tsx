import Link from 'next/link';
import type { DoctorSummary } from '@clinic/shared';
import { SectionHeading } from '../section-heading';
import { DoctorCard } from '../doctor-card';
import { Button } from '@/components/ui/button';

export function FeaturedDoctorsSection({ doctors }: { doctors: DoctorSummary[] }) {
  if (doctors.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-16">
      <SectionHeading
        eyebrow="Top rated"
        title="Featured doctors"
        action={
          <Button variant="outline" render={<Link href="/doctors" />}>
            View all doctors
          </Button>
        }
      />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {doctors.map((doctor) => (
          <DoctorCard key={doctor.id} doctor={doctor} />
        ))}
      </div>
    </section>
  );
}
