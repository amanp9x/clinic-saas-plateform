'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, Stethoscope } from 'lucide-react';
import { RequireAuth } from '@/components/auth/require-auth';
import { DoctorNavLinks } from '@/components/doctor/doctor-nav-links';
import { DoctorStatusSwitcher } from '@/components/doctor/doctor-status-switcher';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import { useLogout } from '@/hooks/use-auth-mutations';
import { UserRole } from '@clinic/shared';

function DoctorPortalShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const logout = useLogout();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user && user.role !== UserRole.DOCTOR) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (user && user.role !== UserRole.DOCTOR) {
    return null;
  }

  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-64 shrink-0 border-r bg-muted/20 lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-2 border-b px-5 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Stethoscope className="size-4" />
          </span>
          Doctor Portal
        </div>
        <div className="flex-1 space-y-1 p-3">
          <DoctorNavLinks />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b px-4 lg:px-6">
          <div className="flex items-center gap-2">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader>
                  <SheetTitle>Doctor Portal</SheetTitle>
                </SheetHeader>
                <div className="p-3">
                  <DoctorNavLinks onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Back to site
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <DoctorStatusSwitcher />
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="outline" size="sm">
                  {user?.email ?? user?.phone ?? 'Account'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem render={<Link href="/doctor/settings/profile" />}>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logout.mutate(undefined, { onSuccess: () => router.push('/login') })}
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 bg-muted/10 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export default function DoctorLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <DoctorPortalShell>{children}</DoctorPortalShell>
    </RequireAuth>
  );
}
