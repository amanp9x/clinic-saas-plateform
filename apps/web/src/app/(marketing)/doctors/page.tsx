import type { Metadata } from 'next';
import { getCities, getSpecializations, searchDoctors } from '@/lib/catalog-api';
import { DoctorCard } from '@/components/marketing/doctor-card';
import { DoctorFilters } from '@/components/marketing/doctor-filters';
import { DoctorSortSelect } from '@/components/marketing/doctor-sort-select';
import { SearchPagination } from '@/components/marketing/search-pagination';
import { EmptyState } from '@/components/marketing/empty-state';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { SlidersHorizontal } from 'lucide-react';

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toStringParams(searchParams: SearchParams): Record<string, string | undefined> {
  return {
    query: first(searchParams.query),
    city: first(searchParams.city),
    specializationSlug: first(searchParams.specializationSlug),
    gender: first(searchParams.gender),
    minExperience: first(searchParams.minExperience),
    maxFee: first(searchParams.maxFee),
    minRating: first(searchParams.minRating),
    availableToday: first(searchParams.availableToday),
    onlineConsultation: first(searchParams.onlineConsultation),
    sort: first(searchParams.sort),
  };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const params = toStringParams(await searchParams);
  const parts = ['Find Doctors'];
  if (params.city) parts.unshift(`Doctors in ${params.city}`);
  return {
    title: parts.join(' | '),
    description: 'Search verified doctors by speciality, city, fees, rating, and availability.',
  };
}

export default async function DoctorsSearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const rawParams = await searchParams;
  const params = toStringParams(rawParams);
  const page = Number(first(rawParams.page) ?? '1') || 1;

  const [specializations, cities, results] = await Promise.all([
    getSpecializations(),
    getCities(),
    searchDoctors({
      query: params.query,
      city: params.city,
      specializationSlug: params.specializationSlug,
      gender: params.gender,
      minExperience: params.minExperience ? Number(params.minExperience) : undefined,
      maxFee: params.maxFee ? Number(params.maxFee) : undefined,
      minRating: params.minRating ? Number(params.minRating) : undefined,
      availableToday: params.availableToday === 'true',
      onlineConsultation: params.onlineConsultation === 'true',
      sort: params.sort,
      page,
      limit: 12,
    }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Find Doctors</h1>
          <p className="text-muted-foreground text-sm">
            {results.total} {results.total === 1 ? 'doctor' : 'doctors'} found
          </p>
        </div>
        <div className="flex items-center gap-2">
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
                <DoctorFilters specializations={specializations} cities={cities} initial={params} />
              </div>
            </SheetContent>
          </Sheet>
          <DoctorSortSelect sort={params.sort ?? 'relevance'} searchParams={params} />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block">
          <DoctorFilters specializations={specializations} cities={cities} initial={params} />
        </aside>

        <div className="space-y-8">
          {results.items.length === 0 ? (
            <EmptyState
              title="No doctors match your filters"
              description="Try widening your search — remove a filter or search a nearby city."
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {results.items.map((doctor) => (
                <DoctorCard key={doctor.id} doctor={doctor} />
              ))}
            </div>
          )}

          <SearchPagination
            basePath="/doctors"
            params={params}
            page={results.page}
            totalPages={results.totalPages}
          />
        </div>
      </div>
    </div>
  );
}
