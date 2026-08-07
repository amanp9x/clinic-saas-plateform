'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MapPin, Search, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SpecializationSummary } from '@clinic/shared';

export function DoctorSearchBar({
  specializations,
  cities,
}: {
  specializations: SpecializationSummary[];
  cities: string[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [specializationSlug, setSpecializationSlug] = useState<string>('');
  const [city, setCity] = useState<string>('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query) params.set('query', query);
    if (specializationSlug) params.set('specializationSlug', specializationSlug);
    if (city) params.set('city', city);
    router.push(`/doctors${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <form
      onSubmit={onSubmit}
      className="bg-card grid gap-3 rounded-xl border p-3 shadow-sm sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
    >
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search doctors, specialities..."
          className="pl-9"
        />
      </div>

      <Select value={specializationSlug} onValueChange={(v) => setSpecializationSlug(v ?? '')}>
        <SelectTrigger className="w-full sm:w-52">
          <Stethoscope className="text-muted-foreground size-4" />
          <SelectValue placeholder="Any speciality" />
        </SelectTrigger>
        <SelectContent>
          {specializations.map((s) => (
            <SelectItem key={s.id} value={s.slug}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={city} onValueChange={(v) => setCity(v ?? '')}>
        <SelectTrigger className="w-full sm:w-44">
          <MapPin className="text-muted-foreground size-4" />
          <SelectValue placeholder="Any city" />
        </SelectTrigger>
        <SelectContent>
          {cities.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button type="submit" className="w-full sm:w-auto">
        Search
      </Button>
    </form>
  );
}
