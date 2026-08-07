import type { Metadata } from 'next';
import { getCities, searchClinics } from '@/lib/catalog-api';
import { ClinicCard } from '@/components/marketing/clinic-card';
import { FacilitySearchBar } from '@/components/marketing/facility-search-bar';
import { SearchPagination } from '@/components/marketing/search-pagination';
import { EmptyState } from '@/components/marketing/empty-state';

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata: Metadata = {
  title: 'Find Clinics',
  description: 'Search clinics by name or city and see how many doctors practice there.',
};

export default async function ClinicsSearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;
  const query = first(raw.query);
  const city = first(raw.city);
  const page = Number(first(raw.page) ?? '1') || 1;

  const [cities, results] = await Promise.all([
    getCities(),
    searchClinics({ query, city, page, limit: 12 }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Find Clinics</h1>
        <p className="text-muted-foreground text-sm">
          {results.total} {results.total === 1 ? 'clinic' : 'clinics'} found
        </p>
      </div>

      <div className="mb-8">
        <FacilitySearchBar
          basePath="/clinics"
          cities={cities}
          initialQuery={query}
          initialCity={city}
        />
      </div>

      {results.items.length === 0 ? (
        <EmptyState
          title="No clinics match your search"
          description="Try a different name or city."
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.items.map((clinic) => (
            <ClinicCard key={clinic.id} clinic={clinic} />
          ))}
        </div>
      )}

      <div className="mt-8">
        <SearchPagination
          basePath="/clinics"
          params={{ query, city }}
          page={results.page}
          totalPages={results.totalPages}
        />
      </div>
    </div>
  );
}
