'use client';

import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const OPTIONS = [
  { value: 'relevance', label: 'Most relevant' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'experience', label: 'Most experienced' },
  { value: 'fee_low', label: 'Fee: low to high' },
  { value: 'fee_high', label: 'Fee: high to low' },
];

export function DoctorSortSelect({
  sort,
  searchParams,
}: {
  sort: string;
  searchParams: Record<string, string | undefined>;
}) {
  const router = useRouter();

  const onChange = (value: string | null) => {
    const params = new URLSearchParams();
    for (const [key, v] of Object.entries(searchParams)) {
      if (v) params.set(key, v);
    }
    if (value) params.set('sort', value);
    params.delete('page');
    router.push(`/doctors?${params.toString()}`);
  };

  return (
    <Select value={sort} onValueChange={onChange}>
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
