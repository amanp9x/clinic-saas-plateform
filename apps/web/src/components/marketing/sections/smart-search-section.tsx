import type { SpecializationSummary } from '@clinic/shared';
import { DoctorSearchBar } from '../doctor-search-bar';

export function SmartSearchSection({
  specializations,
  cities,
}: {
  specializations: SpecializationSummary[];
  cities: string[];
}) {
  return (
    <section className="mx-auto max-w-4xl px-4 py-10">
      <DoctorSearchBar specializations={specializations} cities={cities} />
    </section>
  );
}
