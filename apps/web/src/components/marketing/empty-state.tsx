import type { LucideIcon } from 'lucide-react';
import { SearchX } from 'lucide-react';

export function EmptyState({
  title,
  description,
  icon: Icon = SearchX,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
      <Icon className="text-muted-foreground size-8" />
      <p className="font-medium">{title}</p>
      {description && <p className="text-muted-foreground max-w-sm text-sm">{description}</p>}
    </div>
  );
}
