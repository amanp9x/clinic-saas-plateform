const WEEKDAY_LABELS: Record<string, string> = {
  MON: 'Mon',
  TUE: 'Tue',
  WED: 'Wed',
  THU: 'Thu',
  FRI: 'Fri',
  SAT: 'Sat',
  SUN: 'Sun',
};

export function formatFee(fee: string | null): string {
  if (!fee) return 'Fee on request';
  const amount = Number(fee);
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatExperience(years: number | null): string {
  if (years === null) return 'Experience not listed';
  return `${years} ${years === 1 ? 'year' : 'years'} experience`;
}

export function formatDays(days: string[]): string {
  if (days.length === 0) return 'Timings not listed';
  if (days.length === 7) return 'Every day';
  return days.map((d) => WEEKDAY_LABELS[d] ?? d).join(', ');
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function initials(name: string): string {
  return name
    .replace(/^Dr\.?\s*/i, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
