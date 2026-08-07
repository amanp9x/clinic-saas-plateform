'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function FacilitySearchBar({
  basePath,
  cities,
  initialQuery,
  initialCity,
}: {
  basePath: string;
  cities: string[];
  initialQuery?: string;
  initialCity?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery ?? '');
  const [city, setCity] = useState(initialCity ?? '');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query) params.set('query', query);
    if (city) params.set('city', city);
    router.push(`${basePath}${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <form
      onSubmit={onSubmit}
      className="bg-card grid gap-3 rounded-xl border p-3 shadow-sm sm:grid-cols-[1fr_auto_auto] sm:items-center"
    >
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name..."
          className="pl-9"
        />
      </div>

      <Select value={city} onValueChange={(v) => setCity(v ?? '')}>
        <SelectTrigger className="w-full sm:w-48">
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
