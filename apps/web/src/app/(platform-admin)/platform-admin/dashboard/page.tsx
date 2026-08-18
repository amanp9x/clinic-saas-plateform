'use client';

import { Building2, ClipboardCheck, Stethoscope, Users } from 'lucide-react';
import { usePlatformOverview } from '@/hooks/platform-admin/use-platform-admin';
import { StatCard, StatCardSkeleton } from '@/components/patient/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Not submitted',
  SUBMITTED: 'Awaiting review',
  UNDER_REVIEW: 'Under review',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
};

export default function PlatformAdminDashboardPage() {
  const { data: overview, isLoading } = usePlatformOverview();
  const pendingReview = overview?.verificationBreakdown.find((b) => b.status === 'SUBMITTED')?.count ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Platform Overview</h1>
        <p className="text-muted-foreground text-sm">Clinics, verification queue, and platform-wide counts.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading || !overview ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard icon={Building2} label="Total clinics" value={overview.totalClinics} href="/platform-admin/clinics" />
            <StatCard
              icon={ClipboardCheck}
              label="Awaiting review"
              value={pendingReview}
              hint={pendingReview > 0 ? 'Needs attention' : undefined}
              href="/platform-admin/clinics?verificationStatus=SUBMITTED"
            />
            <StatCard icon={Stethoscope} label="Total doctors" value={overview.totalDoctors} href="/platform-admin/clinics" />
            <StatCard icon={Users} label="Total patients" value={overview.totalPatients} href="/platform-admin/clinics" />
          </>
        )}
      </div>

      {overview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verification breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overview.verificationBreakdown.map((b) => (
              <div key={b.status} className="flex items-center justify-between text-sm">
                <span>{STATUS_LABEL[b.status] ?? b.status}</span>
                <span className="font-medium">{b.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
