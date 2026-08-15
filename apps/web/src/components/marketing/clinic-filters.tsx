'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConsultationType } from '@clinic/shared';
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

export interface ClinicFiltersValue {
  query?: string;
  city?: string;
  area?: string;
  minRating?: string;
  maxFee?: string;
  availableToday?: string;
  consultationType?: string;
  service?: string;
}

const CONSULTATION_TYPE_LABELS: Record<string, string> = {
  [ConsultationType.IN_CLINIC]: 'In-clinic',
  [ConsultationType.ONLINE]: 'Online',
};

export function ClinicFilters({
  cities,
  initial,
}: {
  cities: string[];
  initial: ClinicFiltersValue;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ClinicFiltersValue>(initial);

  const update = <K extends keyof ClinicFiltersValue>(key: K, value: ClinicFiltersValue[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const apply = () => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
      if (value) params.set(key, value);
    }
    router.push(`/clinics?${params.toString()}`);
  };

  const clear = () => {
    setValues({});
    router.push('/clinics');
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
        <Label htmlFor="clinicArea">Area</Label>
        <Input
          id="clinicArea"
          value={values.area ?? ''}
          onChange={(e) => update('area', e.target.value || undefined)}
          placeholder="e.g. Andheri West"
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
        <p className="text-muted-foreground text-xs">Clinics with at least one doctor rated this or higher.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="clinicMaxFee">Maximum fee (₹)</Label>
        <Input
          id="clinicMaxFee"
          type="number"
          min={0}
          value={values.maxFee ?? ''}
          onChange={(e) => update('maxFee', e.target.value || undefined)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Consultation type</Label>
        <Select
          value={values.consultationType ?? ''}
          onValueChange={(v) => update('consultationType', v ?? undefined)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CONSULTATION_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="clinicService">Service</Label>
        <Input
          id="clinicService"
          value={values.service ?? ''}
          onChange={(e) => update('service', e.target.value || undefined)}
          placeholder="e.g. X-Ray"
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="clinicAvailableToday"
          checked={values.availableToday === 'true'}
          onCheckedChange={(checked) => update('availableToday', checked ? 'true' : undefined)}
        />
        <Label htmlFor="clinicAvailableToday" className="font-normal">
          A doctor available today
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
