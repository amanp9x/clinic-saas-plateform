import { Bell, Clock, ListOrdered, TimerReset } from 'lucide-react';
import { SectionHeading } from '../section-heading';
import { Card, CardContent } from '@/components/ui/card';

const STEPS = [
  {
    icon: ListOrdered,
    title: 'Clinic staff update the queue',
    description:
      'Receptionists mark check-ins, call the next token, and log delays as they happen.',
  },
  {
    icon: TimerReset,
    title: 'You see it live',
    description:
      'Current token, patients ahead, and estimated wait update automatically — no refreshing.',
  },
  {
    icon: Bell,
    title: 'Get notified of delays',
    description:
      'If your doctor is running late, you will see the delay and the reason, instantly.',
  },
];

export function LiveQueueShowcaseSection() {
  return (
    <section className="bg-muted/30 border-y">
      <div className="mx-auto max-w-7xl px-4 py-16">
        <SectionHeading
          eyebrow="Our core feature"
          title="Live queue & delay tracking"
          description="No more sitting in a waiting room wondering how long it will be. See it in real time, straight from clinic staff — never predicted, always accurate."
        />

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {STEPS.map((step) => (
              <div key={step.title} className="bg-card flex gap-4 rounded-xl border p-4">
                <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <step.icon className="size-5" />
                </div>
                <div>
                  <p className="font-semibold">{step.title}</p>
                  <p className="text-muted-foreground text-sm">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          <Card className="border-primary/20 border-2">
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-sm font-medium">
                  Example — Dr. Rohan Mehta
                </p>
                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                  <Clock className="size-3" /> Running 10 min late
                </span>
              </div>
              <div className="grid grid-cols-3 divide-x rounded-lg border text-center">
                <div className="p-4">
                  <p className="text-3xl font-semibold">18</p>
                  <p className="text-muted-foreground text-xs">Current token</p>
                </div>
                <div className="p-4">
                  <p className="text-3xl font-semibold">5</p>
                  <p className="text-muted-foreground text-xs">Patients ahead</p>
                </div>
                <div className="p-4">
                  <p className="text-3xl font-semibold">~25m</p>
                  <p className="text-muted-foreground text-xs">Est. wait</p>
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                Delay reason: Emergency walk-in patient. This is a sample illustration — actual
                doctor profiles show &ldquo;queue not started&rdquo; until a clinic session is live.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
