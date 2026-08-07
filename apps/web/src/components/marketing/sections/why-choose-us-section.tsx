import { BadgeCheck, MapPinned, ShieldCheck, TimerReset } from 'lucide-react';
import { SectionHeading } from '../section-heading';

const REASONS = [
  {
    icon: BadgeCheck,
    title: 'Verified profiles',
    description:
      'Every doctor profile includes real qualifications, experience, and patient reviews.',
  },
  {
    icon: TimerReset,
    title: 'Live queue & delay tracking',
    description:
      'See current token, patients ahead, and delays — updated by clinic staff in real time.',
  },
  {
    icon: MapPinned,
    title: 'Search that fits your life',
    description: 'Filter by city, speciality, fees, gender, rating, and same-day availability.',
  },
  {
    icon: ShieldCheck,
    title: 'Built for trust',
    description: 'Transparent pricing and honest information — no hidden fees, no fake urgency.',
  },
];

export function WhyChooseUsSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16">
      <SectionHeading eyebrow="Why choose us" title="Healthcare discovery, done right" />
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {REASONS.map((reason) => (
          <div key={reason.title} className="space-y-3 rounded-xl border p-5">
            <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
              <reason.icon className="size-5" />
            </div>
            <p className="font-semibold">{reason.title}</p>
            <p className="text-muted-foreground text-sm">{reason.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
