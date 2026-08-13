'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSelectedClinic } from '@/hooks/reception/use-selected-clinic';
import { useReceptionPatientSearch } from '@/hooks/reception/use-reception-patients';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { initials } from '@/lib/format';

function PatientSearchContent() {
  const { clinicId, isLoading: clinicLoading } = useSelectedClinic();
  const [query, setQuery] = useState('');
  const { data, isLoading } = useReceptionPatientSearch(clinicId, query);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Patient Search</h1>
        <p className="text-muted-foreground text-sm">Search patients who have visited this clinic before.</p>
      </div>
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, phone, or email" autoFocus />

      {clinicLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !clinicId ? (
        <EmptyState title="No clinic associated" description="You are not assigned to any clinic yet." />
      ) : query.trim() === '' ? (
        <EmptyState title="Start typing to search" description="Results are limited to patients seen at this clinic." />
      ) : isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState title="No matches" description="No patients found for this clinic matching your search." />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {data!.items.map((p) => (
              <Link key={p.id} href={`/reception/patients/${p.id}?clinicId=${clinicId}`} className="flex items-center gap-3 p-4 hover:bg-muted">
                <Avatar className="size-10">
                  <AvatarFallback>{initials(p.fullName)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{p.fullName}</p>
                  <p className="text-muted-foreground text-xs">
                    {p.phone ?? '—'} {p.age !== null ? `· ${p.age}y` : ''} {p.gender ? `· ${p.gender}` : ''}
                  </p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ReceptionPatientSearchPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-2xl" />}>
      <PatientSearchContent />
    </Suspense>
  );
}
