'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Gender } from '@clinic/shared';
import type { SpecializationSummary } from '@clinic/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface DoctorFiltersValue {
  city?: string;
  specializationSlug?: string;
  gender?: string;
  minExperience?: string;
  maxFee?: string;
  minRating?: string;
  availableToday?: string;
  onlineConsultation?: string;
}

const GENDER_LABELS: Record<string, string> = {
  [Gender.MALE]: 'Male',
  [Gender.FEMALE]: 'Female',
  [Gender.OTHER]: 'Other',
};

export function DoctorFilters({
  specializations,
  cities,
  initial,
}: {
  specializations: SpecializationSummary[];
  cities: string[];
  initial: DoctorFiltersValue;
}) {
  const router = useRouter();
  const [values, setValues] = useState<DoctorFiltersValue>(initial);

  const update = <K extends keyof DoctorFiltersValue>(key: K, value: DoctorFiltersValue[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const apply = () => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
      if (value) params.set(key, value);
    }
    router.push(`/doctors?${params.toString()}`);
  };

  const clear = () => {
    setValues({});
    router.push('/doctors');
  };

  return (
    <div className="space-y-5 rounded-xl border p-4">
      <div className="space-y-1.5">
        <Label>City</Label>
        <Select value={values.city ?? ''} onValueChange={(v) => update('city', v ?? undefined)}>
          <SelectTrigger className="w-full">
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
      </div>

      <div className="space-y-1.5">
        <Label>Speciality</Label>
        <Select
          value={values.specializationSlug ?? ''}
          onValueChange={(v) => update('specializationSlug', v ?? undefined)}
        >
          <SelectTrigger className="w-full">
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
      </div>

      <div className="space-y-1.5">
        <Label>Gender</Label>
        <Select value={values.gender ?? ''} onValueChange={(v) => update('gender', v ?? undefined)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(GENDER_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="minExperience">Minimum experience (years)</Label>
        <Input
          id="minExperience"
          type="number"
          min={0}
          value={values.minExperience ?? ''}
          onChange={(e) => update('minExperience', e.target.value || undefined)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="maxFee">Maximum fee (₹)</Label>
        <Input
          id="maxFee"
          type="number"
          min={0}
          value={values.maxFee ?? ''}
          onChange={(e) => update('maxFee', e.target.value || undefined)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Minimum rating</Label>
        <Select
          value={values.minRating ?? ''}
          onValueChange={(v) => update('minRating', v ?? undefined)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Any rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="4.5">4.5+</SelectItem>
            <SelectItem value="4">4.0+</SelectItem>
            <SelectItem value="3">3.0+</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="availableToday"
          checked={values.availableToday === 'true'}
          onCheckedChange={(checked) => update('availableToday', checked ? 'true' : undefined)}
        />
        <Label htmlFor="availableToday" className="font-normal">
          Available today
        </Label>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="onlineConsultation"
          checked={values.onlineConsultation === 'true'}
          onCheckedChange={(checked) => update('onlineConsultation', checked ? 'true' : undefined)}
        />
        <Label htmlFor="onlineConsultation" className="font-normal">
          Online consultation
        </Label>
      </div>

      <div className="flex gap-2 pt-2">
        <Button className="flex-1" onClick={apply}>
          Apply filters
        </Button>
        <Button variant="ghost" onClick={clear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
