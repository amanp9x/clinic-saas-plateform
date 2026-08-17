'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StarRatingInput({
  label,
  value,
  onChange,
  size = 'default',
}: {
  label: string;
  value: number | undefined;
  onChange: (rating: number) => void;
  size?: 'default' | 'sm';
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
            onClick={() => onChange(star)}
            className="p-0.5"
          >
            <Star
              className={cn(size === 'sm' ? 'size-4' : 'size-6', 'text-amber-500 transition-colors', value && star <= value ? 'fill-amber-500' : 'fill-none')}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
