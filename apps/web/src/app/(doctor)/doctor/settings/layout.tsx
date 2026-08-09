import type { ReactNode } from 'react';
import { DoctorSettingsTabNav } from '@/components/doctor/doctor-settings-tab-nav';

export default function DoctorSettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your profile, clinics, and preferences.</p>
      </div>
      <DoctorSettingsTabNav />
      {children}
    </div>
  );
}
