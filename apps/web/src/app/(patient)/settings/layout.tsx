import type { ReactNode } from 'react';
import { SettingsTabNav } from '@/components/patient/settings-tab-nav';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your profile, security, and preferences.</p>
      </div>
      <SettingsTabNav />
      {children}
    </div>
  );
}
