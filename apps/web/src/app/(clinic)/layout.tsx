'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, Building2 } from 'lucide-react';
import { RequireAuth } from '@/components/auth/require-auth';
import { ClinicNavLinks } from '@/components/clinic/clinic-nav-links';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { useAuth } from '@/hooks/use-auth';
import { useLogout } from '@/hooks/use-auth-mutations';
import { useGenericNotifications, useGenericUnreadCount, useGenericMarkRead, useGenericMarkAllRead } from '@/hooks/use-notifications';
import { useNotificationSocket } from '@/hooks/use-notification-socket';
import { UserRole } from '@clinic/shared';

const ALLOWED_ROLES: UserRole[] = [UserRole.CLINIC_ADMIN, UserRole.CLINIC_STAFF, UserRole.RECEPTIONIST];

function ClinicPortalShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const logout = useLogout();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: notifications } = useGenericNotifications('clinic');
  const { data: unreadCount } = useGenericUnreadCount('clinic');
  const markRead = useGenericMarkRead('clinic');
  const markAllRead = useGenericMarkAllRead('clinic');
  useNotificationSocket(['clinic', 'notifications']);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user && !ALLOWED_ROLES.includes(user.role)) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (user && !ALLOWED_ROLES.includes(user.role)) {
    return null;
  }

  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-64 shrink-0 border-r bg-muted/20 lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-2 border-b px-5 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="size-4" />
          </span>
          Clinic Management
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-3">
          <ClinicNavLinks />
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
                  <SheetTitle>Clinic Management</SheetTitle>
                </SheetHeader>
                <div className="overflow-y-auto p-3">
                  <ClinicNavLinks onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Back to site
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell
              notifications={notifications?.items ?? []}
              unreadCount={unreadCount ?? 0}
              onMarkRead={(id) => markRead.mutate(id)}
              onMarkAllRead={() => markAllRead.mutate()}
              viewAllHref="/clinic/notifications"
            />
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="outline" size="sm">
                  {user?.email ?? user?.phone ?? 'Account'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => logout.mutate(undefined, { onSuccess: () => router.push('/login') })}>
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

export default function ClinicLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <ClinicPortalShell>{children}</ClinicPortalShell>
    </RequireAuth>
  );
}
