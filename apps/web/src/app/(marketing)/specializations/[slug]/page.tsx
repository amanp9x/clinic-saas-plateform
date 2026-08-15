import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSpecializationBySlug, searchDoctors } from '@/lib/catalog-api';
import { DoctorCard } from '@/components/marketing/doctor-card';
import { DoctorSortSelect } from '@/components/marketing/doctor-sort-select';
import { SearchPagination } from '@/components/marketing/search-pagination';
import { EmptyState } from '@/components/marketing/empty-state';
import { SpecializationIcon } from '@/lib/specialization-icons';
import { Button } from '@/components/ui/button';

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

interface Params {
  slug: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const specialization = await getSpecializationBySlug(slug);
  if (!specialization) {
    return { title: 'Specialization not found' };
  }
  return {
    title: `${specialization.name} Doctors`,
    description:
      specialization.description ??
      `Find and compare ${specialization.name} doctors — ratings, fees, and availability.`,
    alternates: { canonical: `/specializations/${specialization.slug}` },
  };
}

export default async function SpecializationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const specialization = await getSpecializationBySlug(slug);
  if (!specialization) {
    notFound();
  }

  const rawParams = await searchParams;
  const page = Number(first(rawParams.page) ?? '1') || 1;
  const sort = first(rawParams.sort);
  const searchParamsForNav: Record<string, string | undefined> = { sort };

  const results = await searchDoctors({
    specializationSlug: specialization.slug,
    sort,
    page,
    limit: 12,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
            <SpecializationIcon iconName={specialization.iconName} className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{specialization.name}</h1>
            <p className="text-muted-foreground text-sm">
              {results.total} {results.total === 1 ? 'doctor' : 'doctors'} found
            </p>
          </div>
        </div>
        <DoctorSortSelect
          sort={sort ?? 'relevance'}
          searchParams={searchParamsForNav}
          basePath={`/specializations/${specialization.slug}`}
        />
      </div>

      <div className="mb-6 flex items-center justify-between gap-4">
        {specialization.description ? (
          <p className="text-muted-foreground max-w-2xl text-sm">{specialization.description}</p>
        ) : (
          <span />
        )}
        <Button variant="outline" size="sm" render={<Link href={`/doctors?specializationSlug=${specialization.slug}`} />}>
          More filters
        </Button>
      </div>

      {results.items.length === 0 ? (
        <EmptyState
          title={`No ${specialization.name} doctors found`}
          description="Check back soon, or browse all doctors instead."
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {results.items.map((doctor) => (
            <DoctorCard key={doctor.id} doctor={doctor} />
          ))}
        </div>
      )}

      <div className="mt-8">
        <SearchPagination
          basePath={`/specializations/${specialization.slug}`}
          params={searchParamsForNav}
          page={results.page}
          totalPages={results.totalPages}
        />
      </div>
    </div>
  );
}
