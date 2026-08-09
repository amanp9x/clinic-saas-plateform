'use client';

import { Download, FileText, FlaskConical } from 'lucide-react';
import { useDownloads } from '@/hooks/patient/use-medical-records';
import { EmptyState } from '@/components/marketing/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';

export default function DownloadsPage() {
  const { data: downloads, isLoading } = useDownloads();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!downloads || downloads.length === 0) {
    return (
      <EmptyState
        icon={Download}
        title="Nothing to download yet"
        description="Downloadable prescriptions and lab reports will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {downloads.map((item) => {
        const Icon = item.kind === 'PRESCRIPTION' ? FileText : FlaskConical;
        return (
          <Card key={item.id}>
            <CardContent className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-muted-foreground text-xs">{formatDate(item.date)}</p>
                </div>
              </div>
              {item.fileUrl ? (
                <Button size="sm" variant="outline" render={<a href={item.fileUrl} target="_blank" rel="noreferrer" />}>
                  <Download className="size-3.5" />
                  Download
                </Button>
              ) : (
                <span className="text-muted-foreground text-xs">Not available</span>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
