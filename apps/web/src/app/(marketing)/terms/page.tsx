import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: 'The terms and conditions governing your use of Clinic SaaS Platform.',
};

const LAST_UPDATED = 'August 7, 2026';

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Terms &amp; Conditions</h1>
      <p className="text-muted-foreground mt-2 text-sm">Last updated: {LAST_UPDATED}</p>

      <div className="text-muted-foreground mt-8 space-y-8 text-sm leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-foreground text-lg font-semibold">1. Acceptance of terms</h2>
          <p>
            By accessing or using Clinic SaaS Platform (&quot;the Platform&quot;), you agree to be
            bound by these Terms &amp; Conditions. If you do not agree, please do not use the
            Platform.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-lg font-semibold">2. Description of service</h2>
          <p>
            The Platform provides a directory to search for doctors, clinics, and hospitals, along
            with real-time queue and delay information supplied by participating clinics.
            Appointment booking and other features are being rolled out progressively; availability
            of any specific feature is not guaranteed at all times.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-lg font-semibold">
            3. Not a substitute for medical advice
          </h2>
          <p>
            Information on the Platform, including doctor profiles, reviews, and health articles, is
            provided for general informational purposes only and does not constitute medical advice.
            Always consult a qualified healthcare professional for diagnosis and treatment. In a
            medical emergency, contact your local emergency services immediately.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-lg font-semibold">4. Account responsibilities</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>You must provide accurate information when creating an account.</li>
            <li>
              You are responsible for maintaining the confidentiality of your password and login
              sessions.
            </li>
            <li>You must notify us promptly of any unauthorized use of your account.</li>
            <li>
              You must be legally capable of entering into a binding contract to create an account.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-lg font-semibold">
            5. Live queue and delay information
          </h2>
          <p>
            Queue status, token numbers, and delay estimates are entered manually by clinic staff
            and reflect their best real-time knowledge. While we strive for accuracy, this
            information is provided &quot;as is&quot; and actual wait times may vary. The Platform
            is not liable for discrepancies between displayed and actual wait times.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-lg font-semibold">6. Doctor and clinic listings</h2>
          <p>
            We take reasonable steps to verify the accuracy of doctor, clinic, and hospital
            listings, but we do not guarantee completeness or that any specific doctor is currently
            accepting patients. Consultation fees and availability are subject to change by the
            respective clinic.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-lg font-semibold">7. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Use the Platform for any unlawful purpose.</li>
            <li>Submit false, misleading, or defamatory reviews or content.</li>
            <li>Attempt to gain unauthorized access to any part of the Platform.</li>
            <li>
              Interfere with or disrupt the Platform&apos;s infrastructure or security features.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-lg font-semibold">8. Limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, the Platform and its operators shall not be
            liable for any indirect, incidental, or consequential damages arising from your use of
            the Platform, including reliance on doctor listings or queue information.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-lg font-semibold">9. Changes to these terms</h2>
          <p>
            We may revise these Terms &amp; Conditions from time to time. Continued use of the
            Platform after changes take effect constitutes acceptance of the revised terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-lg font-semibold">10. Contact us</h2>
          <p>
            Questions about these terms can be sent through our{' '}
            <a href="/contact" className="text-primary hover:underline">
              contact page
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
