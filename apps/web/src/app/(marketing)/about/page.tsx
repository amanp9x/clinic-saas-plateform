import type { Metadata } from 'next';
import { HeartHandshake, ShieldCheck, TimerReset, Users } from 'lucide-react';
import { searchClinics, searchDoctors, searchHospitals } from '@/lib/catalog-api';
import { SectionHeading } from '@/components/marketing/section-heading';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'Learn about our mission to make finding the right doctor — and knowing how long the wait really is — simple and transparent.',
};

const VALUES = [
  {
    icon: ShieldCheck,
    title: 'Transparency first',
    description:
      'Real doctor profiles, real reviews, real pricing. No dark patterns, no hidden fees.',
  },
  {
    icon: TimerReset,
    title: 'Respect for your time',
    description:
      'Live queue and delay tracking exists because your time waiting in a clinic matters.',
  },
  {
    icon: Users,
    title: 'Built with clinics, not just for patients',
    description:
      'Receptionists and clinic staff stay in control — we just make their updates visible.',
  },
  {
    icon: HeartHandshake,
    title: 'Healthcare shouldn’t be confusing',
    description:
      'Clear information, plain language, and an experience that respects your intelligence.',
  },
];

export default async function AboutPage() {
  const [doctors, clinics, hospitals] = await Promise.all([
    searchDoctors({ limit: 1 }),
    searchClinics({ limit: 1 }),
    searchHospitals({ limit: 1 }),
  ]);

  const stats = [
    { label: 'Verified doctors', value: doctors.total },
    { label: 'Partner clinics', value: clinics.total },
    { label: 'Partner hospitals', value: hospitals.total },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="space-y-4 text-center">
        <p className="text-primary text-sm font-semibold uppercase tracking-wide">About us</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Healthcare discovery that respects your time
        </h1>
        <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
          We built this platform because finding the right doctor shouldn&apos;t mean guesswork, and
          waiting for your appointment shouldn&apos;t mean sitting in the dark about how long it
          will take.
        </p>
      </div>

      <div className="bg-muted/30 mt-12 grid grid-cols-3 gap-4 rounded-xl border p-6 text-center">
        {stats.map((stat) => (
          <div key={stat.label}>
            <p className="text-3xl font-semibold">{stat.value}+</p>
            <p className="text-muted-foreground text-sm">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-16 space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Our story</h2>
        <p className="text-muted-foreground">
          Every patient has waited for a delayed appointment without knowing why, or picked a doctor
          based on incomplete information. We started this platform to fix both problems at once: a
          searchable, honest directory of doctors, clinics, and hospitals — paired with live queue
          and delay updates that come directly from clinic staff, not predictions.
        </p>
        <p className="text-muted-foreground">
          We&apos;re building this deliberately, one module at a time — starting with a solid
          foundation for search and discovery, with appointment booking and real-time queue tracking
          arriving in upcoming releases.
        </p>
      </div>

      <div className="mt-16">
        <SectionHeading title="What we stand for" />
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {VALUES.map((value) => (
            <div key={value.title} className="flex gap-4 rounded-xl border p-5">
              <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <value.icon className="size-5" />
              </div>
              <div>
                <p className="font-semibold">{value.title}</p>
                <p className="text-muted-foreground text-sm">{value.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
