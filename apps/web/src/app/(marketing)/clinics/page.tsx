import type { Metadata } from 'next';
import { SlidersHorizontal } from 'lucide-react';
import { getCities, searchClinics } from '@/lib/catalog-api';
import { ClinicCard } from '@/components/marketing/clinic-card';
import { ClinicFilters } from '@/components/marketing/clinic-filters';
import { FacilitySearchBar } from '@/components/marketing/facility-search-bar';
import { SearchPagination } from '@/components/marketing/search-pagination';
import { EmptyState } from '@/components/marketing/empty-state';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toStringParams(searchParams: SearchParams): Record<string, string | undefined> {
  return {
    query: first(searchParams.query),
    city: first(searchParams.city),
    area: first(searchParams.area),
    minRating: first(searchParams.minRating),
    maxFee: first(searchParams.maxFee),
    availableToday: first(searchParams.availableToday),
    consultationType: first(searchParams.consultationType),
    service: first(searchParams.service),
  };
}

export const metadata: Metadata = {
  title: 'Find Clinics',
  description: 'Search clinics by name, city, area, services, and doctor availability.',
  alternates: { canonical: '/clinics' },
};

export default async function ClinicsSearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const rawParams = await searchParams;
  const params = toStringParams(rawParams);
  const page = Number(first(rawParams.page) ?? '1') || 1;

  const [cities, results] = await Promise.all([
    getCities(),
    searchClinics({
      query: params.query,
      city: params.city,
      area: params.area,
      minRating: params.minRating ? Number(params.minRating) : undefined,
      maxFee: params.maxFee ? Number(params.maxFee) : undefined,
      availableToday: params.availableToday === 'true',
      consultationType: params.consultationType,
      service: params.service,
      page,
      limit: 12,
    }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Find Clinics</h1>
          <p className="text-muted-foreground text-sm">
            {results.total} {results.total === 1 ? 'clinic' : 'clinics'} found
          </p>
        </div>
        <Sheet>
          <SheetTrigger>
            <Button variant="outline" className="lg:hidden">
              <SlidersHorizontal className="size-4" />
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="px-4">
              <ClinicFilters cities={cities} initial={params} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="mb-8">
        <FacilitySearchBar
          basePath="/clinics"
          cities={cities}
          initialQuery={params.query}
          initialCity={params.city}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block">
          <ClinicFilters cities={cities} initial={params} />
        </aside>

        <div className="space-y-8">
          {results.items.length === 0 ? (
            <EmptyState
              title="No clinics match your search"
              description="Try a different name, city, or remove a filter."
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {results.items.map((clinic) => (
                <ClinicCard key={clinic.id} clinic={clinic} />
              ))}
            </div>
          )}

          <SearchPagination
            basePath="/clinics"
            params={params}
            page={results.page}
            totalPages={results.totalPages}
          />
        </div>
      </div>
    </div>
  );
}
