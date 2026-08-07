import type { Metadata } from 'next';
import { getCities, searchHospitals } from '@/lib/catalog-api';
import { HospitalCard } from '@/components/marketing/hospital-card';
import { FacilitySearchBar } from '@/components/marketing/facility-search-bar';
import { SearchPagination } from '@/components/marketing/search-pagination';
import { EmptyState } from '@/components/marketing/empty-state';

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata: Metadata = {
  title: 'Find Hospitals',
  description: 'Search hospitals by name or city.',
};

export default async function HospitalsSearchPage({
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
    searchHospitals({ query, city, page, limit: 12 }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Find Hospitals</h1>
        <p className="text-muted-foreground text-sm">
          {results.total} {results.total === 1 ? 'hospital' : 'hospitals'} found
        </p>
      </div>

      <div className="mb-8">
        <FacilitySearchBar
          basePath="/hospitals"
          cities={cities}
          initialQuery={query}
          initialCity={city}
        />
      </div>

      {results.items.length === 0 ? (
        <EmptyState
          title="No hospitals match your search"
          description="Try a different name or city."
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.items.map((hospital) => (
            <HospitalCard key={hospital.id} hospital={hospital} />
          ))}
        </div>
      )}

      <div className="mt-8">
        <SearchPagination
          basePath="/hospitals"
          params={{ query, city }}
          page={results.page}
          totalPages={results.totalPages}
        />
      </div>
    </div>
  );
}
