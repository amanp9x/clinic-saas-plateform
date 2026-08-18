'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, ShieldCheck } from 'lucide-react';
import { RequireAuth } from '@/components/auth/require-auth';
import { PlatformAdminNavLinks } from '@/components/platform-admin/platform-admin-nav-links';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import { useLogout } from '@/hooks/use-auth-mutations';
import { UserRole } from '@clinic/shared';

const ALLOWED_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN];

function PlatformAdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const logout = useLogout();
  const [mobileOpen, setMobileOpen] = useState(false);

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
            <ShieldCheck className="size-4" />
          </span>
          Platform Admin
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-3">
          <PlatformAdminNavLinks />
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
                  <SheetTitle>Platform Admin</SheetTitle>
                </SheetHeader>
                <div className="overflow-y-auto p-3">
                  <PlatformAdminNavLinks onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Back to site
            </Link>
          </div>

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
        </header>

        <main className="flex-1 bg-muted/10 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export default function PlatformAdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <PlatformAdminShell>{children}</PlatformAdminShell>
    </RequireAuth>
  );
}
