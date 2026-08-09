import type { ReactNode } from 'react';
import { MedicalRecordsTabNav } from '@/components/patient/medical-records-tab-nav';

export default function MedicalRecordsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Medical Records</h1>
        <p className="text-muted-foreground text-sm">Your health history, prescriptions, and reports.</p>
      </div>
      <MedicalRecordsTabNav />
      {children}
    </div>
  );
}
