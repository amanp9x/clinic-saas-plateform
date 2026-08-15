import type { Metadata } from 'next';
import { getSpecializations } from '@/lib/catalog-api';
import { SpecialtyCard } from '@/components/marketing/specialty-card';

export const metadata: Metadata = {
  title: 'Browse Specializations',
  description: 'Explore doctors by medical specialization — cardiology, dermatology, pediatrics, and more.',
  alternates: { canonical: '/specializations' },
};

export default async function SpecializationsDirectoryPage() {
  const specializations = await getSpecializations();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Browse Specializations</h1>
        <p className="text-muted-foreground text-sm">
          Find the right specialist for your needs.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {specializations.map((s) => (
          <SpecialtyCard key={s.id} specialization={s} />
        ))}
      </div>
    </div>
  );
}
