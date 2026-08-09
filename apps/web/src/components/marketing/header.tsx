'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useLogout } from '@/hooks/use-auth-mutations';

const NAV_LINKS = [
  { href: '/doctors', label: 'Find Doctors' },
  { href: '/clinics', label: 'Clinics' },
  { href: '/hospitals', label: 'Hospitals' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const logout = useLogout();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <Stethoscope className="size-4" />
          </span>
          <span className="hidden sm:inline">Clinic SaaS Platform</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-muted-foreground hover:text-foreground rounded-md px-3 py-2 text-sm font-medium transition-colors',
                pathname.startsWith(link.href) && 'text-foreground',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {isLoading ? (
            <Skeleton className="h-9 w-24" />
          ) : isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="outline">{user?.email ?? user?.phone ?? 'Account'}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user?.role}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/dashboard" />}>Dashboard</DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/settings/profile" />}>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    logout.mutate(undefined, { onSuccess: () => router.push('/login') })
                  }
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" render={<Link href="/login" />}>
                Sign in
              </Button>
              <Button render={<Link href="/register" />}>Register</Button>
            </>
          )}
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-4">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="hover:bg-muted rounded-md px-3 py-2 text-sm font-medium"
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-4 flex flex-col gap-2 border-t pt-4">
                {isAuthenticated ? (
                  <>
                    <Button variant="outline" render={<Link href="/dashboard" />}>
                      Dashboard
                    </Button>
                    <Button variant="ghost" render={<Link href="/settings/profile" />}>
                      Settings
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setMobileOpen(false);
                        logout.mutate(undefined, { onSuccess: () => router.push('/login') });
                      }}
                    >
                      Sign out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" render={<Link href="/login" />}>
                      Sign in
                    </Button>
                    <Button render={<Link href="/register" />}>Register</Button>
                  </>
                )}
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
