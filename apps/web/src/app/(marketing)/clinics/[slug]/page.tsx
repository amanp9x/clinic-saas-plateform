import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Building2, Globe2, MapPin, Phone } from 'lucide-react';
import { getClinicBySlug } from '@/lib/catalog-api';
import { clientEnv } from '@/lib/env';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DoctorCard } from '@/components/marketing/doctor-card';
import { BookAppointmentButton } from '@/components/marketing/book-appointment-button';
import { FavoriteButton } from '@/components/marketing/favorite-button';
import { EmptyState } from '@/components/marketing/empty-state';
import { formatDate } from '@/lib/format';

const WEEKDAY_LABELS: Record<string, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday',
};

interface Params {
  slug: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const clinic = await getClinicBySlug(slug);
  if (!clinic) {
    return { title: 'Clinic not found' };
  }

  const title = `${clinic.name} — ${[clinic.area, clinic.city].filter(Boolean).join(', ') || 'Clinic'}`;
  const description =
    clinic.description ?? `${clinic.name} clinic profile: doctors, services, timings, and location.`;

  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    alternates: { canonical: `/clinics/${clinic.slug}` },
  };
}

export default async function ClinicProfilePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const clinic = await getClinicBySlug(slug);
  if (!clinic) {
    notFound();
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalClinic',
    name: clinic.name,
    url: `${clientEnv.siteUrl}/clinics/${clinic.slug}`,
    image: clinic.photoUrl ?? undefined,
    telephone: clinic.phone ?? undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: [clinic.addressLine1, clinic.addressLine2].filter(Boolean).join(', ') || undefined,
      addressLocality: clinic.city ?? undefined,
      addressRegion: clinic.state ?? undefined,
      postalCode: clinic.postalCode ?? undefined,
    },
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">{clinic.name}</h1>
                  <p className="text-muted-foreground text-sm">
                    {[clinic.addressLine1, clinic.area, clinic.city, clinic.state].filter(Boolean).join(', ')}
                  </p>
                </div>
                <FavoriteButton type="clinic" id={clinic.id} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {clinic.city && (
                  <Badge variant="secondary">
                    <MapPin className="size-3" /> {[clinic.area, clinic.city].filter(Boolean).join(', ')}
                  </Badge>
                )}
                {clinic.phone && (
                  <Badge variant="secondary">
                    <Phone className="size-3" /> {clinic.phone}
                  </Badge>
                )}
                {clinic.website && (
                  <Badge variant="secondary">
                    <Globe2 className="size-3" /> Website
                  </Badge>
                )}
                <Badge variant="secondary">
                  <Building2 className="size-3" /> {clinic.doctorCount}{' '}
                  {clinic.doctorCount === 1 ? 'doctor' : 'doctors'}
                </Badge>
              </div>
              {clinic.description && <p className="text-muted-foreground text-sm">{clinic.description}</p>}
            </CardContent>
          </Card>

          {(clinic.facilities.length > 0 || clinic.languages.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Facilities &amp; languages</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {clinic.facilities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {clinic.facilities.map((f) => (
                      <Badge key={f} variant="outline">
                        {f}
                      </Badge>
                    ))}
                  </div>
                )}
                {clinic.languages.length > 0 && (
                  <p className="text-muted-foreground text-sm">
                    Languages spoken: {clinic.languages.join(', ')}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Working hours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {clinic.workingHours.length === 0 && (
                <p className="text-muted-foreground text-sm">Working hours not listed.</p>
              )}
              {clinic.workingHours.map((wh) => (
                <div key={wh.weekday} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{WEEKDAY_LABELS[wh.weekday] ?? wh.weekday}</span>
                  <span className="text-muted-foreground">
                    {wh.isOpen
                      ? wh.sessions.length > 0
                        ? wh.sessions.map((s) => `${s.startTime}–${s.endTime}`).join(', ')
                        : 'Open'
                      : 'Closed'}
                  </span>
                </div>
              ))}
              {clinic.holidays.length > 0 && (
                <div className="mt-3 border-t pt-3">
                  <p className="text-muted-foreground mb-1 text-xs font-medium">Upcoming holidays</p>
                  {clinic.holidays.map((h) => (
                    <p key={h.date} className="text-muted-foreground text-xs">
                      {formatDate(`${h.date}T00:00:00.000Z`)} — {h.name}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {clinic.services.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Services</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {clinic.services.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{s.name}</span>
                      {s.departmentName && (
                        <span className="text-muted-foreground"> · {s.departmentName}</span>
                      )}
                      <span className="text-muted-foreground"> · {s.durationMinutes} min</span>
                    </div>
                    <span className="font-medium">₹{Number(s.price).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div>
            <h2 className="mb-4 text-lg font-semibold">Doctors at this clinic</h2>
            {clinic.doctors.length === 0 ? (
              <EmptyState title="No doctors listed yet" />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {clinic.doctors.map((doctor) => (
                  <DoctorCard key={doctor.id} doctor={doctor} />
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Browse doctors above and book an appointment at {clinic.name}.
              </p>
              {clinic.doctors.length === 1 && (
                <BookAppointmentButton
                  doctorId={clinic.doctors[0]!.id}
                  doctorName={clinic.doctors[0]!.displayName}
                  clinicId={clinic.id}
                />
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
