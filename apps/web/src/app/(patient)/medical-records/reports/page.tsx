'use client';

import { FlaskConical } from 'lucide-react';
import { useLabReports } from '@/hooks/patient/use-medical-records';
import { EmptyState } from '@/components/marketing/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';

export default function LabReportsPage() {
  const { data: reports, isLoading } = useLabReports();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!reports || reports.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="No lab reports yet"
        description="Lab test reports ordered by your doctors will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <Card key={report.id}>
          <CardContent className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{report.testName}</p>
              <Badge variant={report.status === 'READY' ? 'secondary' : 'outline'}>
                {report.status === 'READY' ? 'Ready' : 'Pending'}
              </Badge>
            </div>
            <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
              {report.labName && <span>{report.labName}</span>}
              {report.reportDate && <span>{formatDate(report.reportDate)}</span>}
            </div>
            {report.notes && <p className="text-muted-foreground text-sm">{report.notes}</p>}
            {report.fileUrl && (
              <a
                href={report.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary inline-block text-sm font-medium hover:underline"
              >
                Download report
              </a>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
