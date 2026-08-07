import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Award, Clock3, Globe2, GraduationCap, Languages, MapPin } from 'lucide-react';
import { getDoctorBySlug } from '@/lib/catalog-api';
import { clientEnv } from '@/lib/env';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RatingStars } from '@/components/marketing/rating-stars';
import { DoctorCard } from '@/components/marketing/doctor-card';
import { DoctorReviews } from '@/components/marketing/doctor-reviews';
import { QueueStatusCard } from '@/components/marketing/queue-status-card';
import { BookAppointmentButton } from '@/components/marketing/book-appointment-button';
import { formatDays, formatExperience, formatFee, initials } from '@/lib/format';

interface Params {
  slug: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const result = await getDoctorBySlug(slug);
  if (!result) {
    return { title: 'Doctor not found' };
  }

  const { doctor } = result;
  const title = `${doctor.displayName} — ${doctor.specializationName ?? 'Doctor'}`;
  const description =
    doctor.bio ??
    `Book a consultation with ${doctor.displayName}, ${doctor.specializationName ?? ''}.`;

  return {
    title,
    description,
    openGraph: { title, description, type: 'profile' },
  };
}

export default async function DoctorProfilePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const result = await getDoctorBySlug(slug);
  if (!result) {
    notFound();
  }

  const { doctor, similarDoctors } = result;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    name: doctor.displayName,
    medicalSpecialty: doctor.specializationName ?? undefined,
    url: `${clientEnv.siteUrl}/doctors/${doctor.slug}`,
    image: doctor.profileImageUrl ?? undefined,
    aggregateRating:
      doctor.ratingAverage !== null
        ? {
            '@type': 'AggregateRating',
            ratingValue: doctor.ratingAverage,
            reviewCount: doctor.ratingCount,
          }
        : undefined,
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <Card>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Avatar className="size-20">
                {doctor.profileImageUrl && (
                  <AvatarImage src={doctor.profileImageUrl} alt={doctor.displayName} />
                )}
                <AvatarFallback className="text-lg">{initials(doctor.displayName)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">{doctor.displayName}</h1>
                  <p className="text-muted-foreground">
                    {doctor.specializationName ?? 'General Practice'}
                  </p>
                </div>
                <RatingStars rating={doctor.ratingAverage} count={doctor.ratingCount} size="md" />
                <div className="flex flex-wrap gap-1.5">
                  {doctor.city && (
                    <Badge variant="secondary">
                      <MapPin className="size-3" /> {doctor.city}
                    </Badge>
                  )}
                  {doctor.onlineConsultation && (
                    <Badge variant="secondary">Online consultation</Badge>
                  )}
                  {doctor.availableToday && <Badge variant="secondary">Available today</Badge>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">About</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {doctor.bio && <p className="text-muted-foreground text-sm">{doctor.bio}</p>}
              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-2">
                  <Award className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <div>
                    <dt className="text-muted-foreground text-xs">Experience</dt>
                    <dd className="text-sm font-medium">
                      {formatExperience(doctor.yearsExperience)}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <GraduationCap className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <div>
                    <dt className="text-muted-foreground text-xs">Qualifications</dt>
                    <dd className="text-sm font-medium">{doctor.qualifications ?? 'Not listed'}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Languages className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <div>
                    <dt className="text-muted-foreground text-xs">Languages</dt>
                    <dd className="text-sm font-medium">
                      {doctor.languages.length > 0 ? doctor.languages.join(', ') : 'Not listed'}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Globe2 className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <div>
                    <dt className="text-muted-foreground text-xs">Consultation fee</dt>
                    <dd className="text-sm font-medium">{formatFee(doctor.consultationFee)}</dd>
                  </div>
                </div>
              </dl>
            </CardContent>
          </Card>

          <QueueStatusCard status={doctor.queueStatus} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clinic timings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {doctor.clinics.length === 0 && (
                <p className="text-muted-foreground text-sm">No clinic affiliations listed.</p>
              )}
              {doctor.clinics.map((affiliation) => (
                <div
                  key={affiliation.clinicId}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <Clock3 className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{affiliation.clinicName}</p>
                    {affiliation.city && (
                      <p className="text-muted-foreground text-xs">{affiliation.city}</p>
                    )}
                    <p className="mt-1 text-sm">{affiliation.timings ?? 'Timings not listed'}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatDays(affiliation.availableDays)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Patient reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <DoctorReviews reviews={doctor.reviews} />
            </CardContent>
          </Card>

          {similarDoctors.length > 0 && (
            <div>
              <h2 className="mb-4 text-lg font-semibold">Similar doctors</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                {similarDoctors.map((similar) => (
                  <DoctorCard key={similar.id} doctor={similar} />
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Consultation fee</span>
                <span className="text-lg font-semibold">{formatFee(doctor.consultationFee)}</span>
              </div>
              <BookAppointmentButton doctorName={doctor.displayName} />
              <p className="text-muted-foreground text-center text-xs">
                No payment required to view availability.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
