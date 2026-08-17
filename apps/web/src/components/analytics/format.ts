export function formatCurrency(amount: number, currency = 'INR'): string {
  const symbol = currency === 'INR' ? '₹' : `${currency} `;
  return `${symbol}${amount.toLocaleString('en-IN')}`;
}

export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return '—';
  return `${Math.round(minutes)} min`;
}

export function formatPercent(ratio: number | null): string {
  if (ratio === null) return '—';
  return `${Math.round(ratio * 1000) / 10}%`;
}
