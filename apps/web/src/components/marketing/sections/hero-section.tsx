import Link from 'next/link';
import { CalendarCheck, ShieldCheck, TimerReset } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function HeroSection() {
  return (
    <section className="bg-linear-to-b from-primary/5 to-background border-b">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
        <div className="space-y-6">
          <span className="bg-background text-muted-foreground inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium">
            Now live in 5 cities across India
          </span>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Find the right doctor.
            <br />
            <span className="text-primary">Know exactly how long you&apos;ll wait.</span>
          </h1>
          <p className="text-muted-foreground max-w-xl text-lg">
            Search verified doctors, clinics, and hospitals near you — and get real-time queue and
            delay updates straight from clinic staff, not guesswork.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" render={<Link href="/doctors" />}>
              Find a doctor
            </Button>
            <Button size="lg" variant="outline" render={<Link href="/register" />}>
              Create free account
            </Button>
          </div>
          <div className="text-muted-foreground flex flex-wrap gap-6 pt-2 text-sm">
            <span className="flex items-center gap-2">
              <ShieldCheck className="text-primary size-4" /> Verified doctor profiles
            </span>
            <span className="flex items-center gap-2">
              <TimerReset className="text-primary size-4" /> Live delay tracking
            </span>
            <span className="flex items-center gap-2">
              <CalendarCheck className="text-primary size-4" /> No more guessing wait times
            </span>
          </div>
        </div>

        <div className="relative hidden lg:block">
          <div className="bg-linear-to-br from-primary/20 absolute inset-0 -z-10 rounded-3xl to-transparent blur-2xl" />
          <div className="bg-card rounded-2xl border p-6 shadow-lg">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <p className="text-muted-foreground text-sm">Dr. Aditi Sharma</p>
                <p className="font-semibold">Cardiologist · Sunrise Family Clinic</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                Available today
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 py-4 text-center">
              <div>
                <p className="text-2xl font-semibold">24</p>
                <p className="text-muted-foreground text-xs">Current token</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">3</p>
                <p className="text-muted-foreground text-xs">Patients ahead</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">~15m</p>
                <p className="text-muted-foreground text-xs">Est. wait</p>
              </div>
            </div>
            <p className="bg-muted text-muted-foreground rounded-lg px-3 py-2 text-center text-xs">
              Illustrative example — live queue tracking activates once a clinic session starts.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
