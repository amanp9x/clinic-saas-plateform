import type { TrendPointDto } from '@clinic/shared';
import { EmptyState } from '@/components/marketing/empty-state';

function formatBucketLabel(bucket: string): string {
  const d = new Date(bucket);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * A single-series magnitude-over-time bar chart, built in plain SVG (no charting library — see
 * the Phase 11 completion report for why). One series needs no legend/categorical palette; the
 * bars use the app's existing `--primary` design token rather than an invented color, so it stays
 * consistent with the rest of the UI. A visually-hidden table carries the same data for screen
 * readers and any environment where the SVG doesn't render — never SVG-only.
 */
export function TrendBarChart({ title, points, valueKey = 'count' }: { title: string; points: TrendPointDto[]; valueKey?: 'count' | 'amount' }) {
  if (points.length === 0) {
    return <EmptyState title="No data available for the selected period." />;
  }

  const values = points.map((p) => (valueKey === 'amount' ? (p.amount ?? 0) : p.count));
  const max = Math.max(...values, 1);
  const barWidth = 100 / points.length;

  return (
    <div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="text-primary h-40 w-full" role="img" aria-label={title}>
        {points.map((p, i) => {
          const value = valueKey === 'amount' ? (p.amount ?? 0) : p.count;
          const height = max > 0 ? (value / max) * 36 : 0;
          return (
            <rect key={p.bucket} x={i * barWidth + barWidth * 0.15} y={40 - height} width={barWidth * 0.7} height={height} rx={0.6} fill="currentColor" fillOpacity={0.85}>
              <title>
                {formatBucketLabel(p.bucket)}: {value}
              </title>
            </rect>
          );
        })}
      </svg>
      <div className="text-muted-foreground mt-1 flex justify-between text-xs">
        <span>{formatBucketLabel(points[0]!.bucket)}</span>
        <span>{formatBucketLabel(points[points.length - 1]!.bucket)}</span>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Period</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.bucket}>
              <td>{formatBucketLabel(p.bucket)}</td>
              <td>{valueKey === 'amount' ? (p.amount ?? 0) : p.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
