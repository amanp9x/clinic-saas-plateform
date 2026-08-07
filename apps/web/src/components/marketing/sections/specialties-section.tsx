import type { SpecializationSummary } from '@clinic/shared';
import { SectionHeading } from '../section-heading';
import { SpecialtyCard } from '../specialty-card';

export function SpecialtiesSection({
  specializations,
}: {
  specializations: SpecializationSummary[];
}) {
  if (specializations.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-16">
      <SectionHeading eyebrow="Browse" title="Browse by speciality" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {specializations.map((specialization) => (
          <SpecialtyCard key={specialization.id} specialization={specialization} />
        ))}
      </div>
    </section>
  );
}
