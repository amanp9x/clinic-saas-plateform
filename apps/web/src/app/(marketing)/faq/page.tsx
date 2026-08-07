import type { Metadata } from 'next';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions',
  description:
    'Answers to common questions about finding doctors, clinics, and live queue tracking.',
};

const FAQS = [
  {
    question: 'How do I find a doctor near me?',
    answer:
      'Use the search bar on the homepage or visit the Find Doctors page. You can filter by city, speciality, gender, experience, fees, rating, same-day availability, and online consultation.',
  },
  {
    question: 'Are the doctor profiles verified?',
    answer:
      'Every doctor listed has their qualifications, experience, and clinic affiliations reviewed before appearing in search results.',
  },
  {
    question: 'Can I book an appointment right now?',
    answer:
      'Online booking is coming soon. Right now you can browse doctors, compare profiles, and reach out via the contact details on each clinic — full in-app booking is on the way.',
  },
  {
    question: 'What is live queue and delay tracking?',
    answer:
      'It is our core feature: clinic staff update the current token, patients ahead, and any delays in real time, so you know exactly how long the wait will be instead of guessing. It activates automatically once a clinic starts using it for a doctor session.',
  },
  {
    question: 'Is live queue tracking available for every doctor today?',
    answer:
      'Not yet — it is rolling out clinic by clinic. Doctor profiles will show "Live" once their clinic has an active session; otherwise you will see a "Not started" status.',
  },
  {
    question: 'Is there a mobile app?',
    answer:
      'A mobile app is in development. In the meantime, the website is fully responsive and works well on mobile browsers.',
  },
  {
    question: 'How do I create an account?',
    answer:
      'Click Register in the top navigation. You can sign up with an email and password, or use a one-time code sent to your email or phone.',
  },
  {
    question: 'How is my data protected?',
    answer:
      'We use industry-standard encryption, secure authentication, and never share your personal information without consent. See our Privacy Policy for full details.',
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="space-y-3 text-center">
        <p className="text-primary text-sm font-semibold uppercase tracking-wide">Support</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Frequently asked questions
        </h1>
        <p className="text-muted-foreground">
          Can&apos;t find what you&apos;re looking for?{' '}
          <a href="/contact" className="text-primary hover:underline">
            Contact us
          </a>
          .
        </p>
      </div>

      <Accordion className="mt-10">
        {FAQS.map((faq, i) => (
          <AccordionItem key={faq.question} value={`item-${i}`}>
            <AccordionTrigger>{faq.question}</AccordionTrigger>
            <AccordionContent>{faq.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
