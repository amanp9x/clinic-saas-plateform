import type { TestimonialDto } from '@clinic/shared';
import { SectionHeading } from '../section-heading';
import { TestimonialCard } from '../testimonial-card';

export function TestimonialsSection({ testimonials }: { testimonials: TestimonialDto[] }) {
  if (testimonials.length === 0) return null;

  return (
    <section className="bg-muted/30 border-y">
      <div className="mx-auto max-w-7xl px-4 py-16">
        <SectionHeading eyebrow="Testimonials" title="What patients are saying" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <TestimonialCard key={testimonial.id} testimonial={testimonial} />
          ))}
        </div>
      </div>
    </section>
  );
}
