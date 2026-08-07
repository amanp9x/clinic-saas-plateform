import type { Metadata } from 'next';
import { Mail, MapPin, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ContactForm } from '@/components/marketing/contact-form';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with our team for support, partnerships, or feedback.',
};

const CONTACT_DETAILS = [
  { icon: Mail, label: 'Email', value: 'support@clinicsaas.example' },
  { icon: Phone, label: 'Phone', value: '+91 22 4000 1234' },
  { icon: MapPin, label: 'Office', value: 'Mumbai, Maharashtra, India' },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="space-y-3 text-center">
        <p className="text-primary text-sm font-semibold uppercase tracking-wide">Contact</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          We&apos;d love to hear from you
        </h1>
        <p className="text-muted-foreground mx-auto max-w-xl">
          Questions, feedback, or partnership enquiries — send us a message and our team will
          respond as soon as possible.
        </p>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-4">
          {CONTACT_DETAILS.map((detail) => (
            <Card key={detail.label}>
              <CardContent className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <detail.icon className="size-5" />
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{detail.label}</p>
                  <p className="text-sm font-medium">{detail.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent>
            <ContactForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
