import { Apple, PlayCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function DownloadAppSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16">
      <div className="bg-linear-to-br from-primary/10 flex flex-col items-center gap-6 rounded-2xl border to-transparent px-6 py-12 text-center">
        <Badge variant="secondary">Coming soon</Badge>
        <h2 className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
          Take live queue tracking with you
        </h2>
        <p className="text-muted-foreground max-w-lg">
          Our mobile app is on the way, with push notifications the moment your doctor is running
          late or your token is coming up next.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <div className="bg-background flex cursor-not-allowed items-center gap-2 rounded-lg border px-4 py-2.5 opacity-60">
            <Apple className="size-5" />
            <div className="text-left">
              <p className="text-muted-foreground text-[10px] leading-none">Coming soon on</p>
              <p className="text-sm font-medium leading-tight">App Store</p>
            </div>
          </div>
          <div className="bg-background flex cursor-not-allowed items-center gap-2 rounded-lg border px-4 py-2.5 opacity-60">
            <PlayCircle className="size-5" />
            <div className="text-left">
              <p className="text-muted-foreground text-[10px] leading-none">Coming soon on</p>
              <p className="text-sm font-medium leading-tight">Google Play</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
