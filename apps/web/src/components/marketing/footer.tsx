import Link from 'next/link';
import { Stethoscope } from 'lucide-react';

const COLUMNS = [
  {
    title: 'Discover',
    links: [
      { href: '/doctors', label: 'Find Doctors' },
      { href: '/clinics', label: 'Find Clinics' },
      { href: '/hospitals', label: 'Find Hospitals' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About Us' },
      { href: '/contact', label: 'Contact' },
      { href: '/faq', label: 'FAQ' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy-policy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms & Conditions' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-muted/30 border-t">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <Stethoscope className="size-4" />
            </span>
            Clinic SaaS Platform
          </Link>
          <p className="text-muted-foreground max-w-xs text-sm">
            Find the right doctor, clinic, or hospital — and know exactly how long you&apos;ll wait,
            with real-time queue updates from clinic staff.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.title} className="space-y-3">
            <p className="text-sm font-semibold">{column.title}</p>
            <ul className="space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="text-muted-foreground border-t px-4 py-6 text-center text-xs">
        © {new Date().getFullYear()} Clinic SaaS Platform. All rights reserved.
      </div>
    </footer>
  );
}
