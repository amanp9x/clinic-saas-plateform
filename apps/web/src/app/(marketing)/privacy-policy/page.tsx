import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How we collect, use, and protect your personal and health-related information.',
};

const LAST_UPDATED = 'August 7, 2026';

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="text-muted-foreground mt-2 text-sm">Last updated: {LAST_UPDATED}</p>

      <div className="text-muted-foreground mt-8 space-y-8 text-sm leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-foreground text-lg font-semibold">1. Introduction</h2>
          <p>
            This Privacy Policy explains how Clinic SaaS Platform (&quot;we&quot;, &quot;us&quot;,
            or &quot;our&quot;) collects, uses, and protects information when you use our website
            and services to search for doctors, clinics, and hospitals. By using our platform, you
            agree to the collection and use of information as described here.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-lg font-semibold">2. Information we collect</h2>
          <p>We collect information you provide directly, including:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Account information: name, email address, phone number, and password.</li>
            <li>Profile information you choose to add, such as date of birth or gender.</li>
            <li>Messages you send us through the contact form.</li>
            <li>
              Technical information such as IP address, device and browser type, and pages visited,
              collected automatically to keep the platform secure and reliable.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-lg font-semibold">3. How we use your information</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>To create and manage your account.</li>
            <li>
              To provide search results and display relevant doctor, clinic, and hospital
              information.
            </li>
            <li>
              To send account-related communications, such as verification codes and security
              alerts.
            </li>
            <li>To respond to enquiries submitted through our contact form.</li>
            <li>To detect, prevent, and address fraud, abuse, and security issues.</li>
            <li>To improve and develop new features on the platform.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-lg font-semibold">4. Health-related information</h2>
          <p>
            As a healthcare discovery platform, we are especially mindful of health-related
            information. We do not sell health information, and we limit access to it to what is
            necessary to provide our services. As features like appointment booking and medical
            records are introduced, this policy will be updated to reflect exactly what is collected
            and how it is protected.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-lg font-semibold">
            5. How we protect your information
          </h2>
          <p>
            We use industry-standard security measures, including encrypted connections, hashed
            passwords, and access controls, to protect your information. Refresh sessions are stored
            securely and can be revoked at any time from your account security settings. No method
            of transmission or storage is 100% secure, and we continuously work to improve our
            safeguards.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-lg font-semibold">6. Sharing of information</h2>
          <p>
            We do not sell your personal information. We may share information with service
            providers who help us operate the platform (such as hosting and email delivery), and
            when required by law.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-lg font-semibold">7. Your rights</h2>
          <p>
            You can review and update your account information at any time, sign out of individual
            or all devices from your account security page, and request deletion of your account by
            contacting us. You may also request a copy of the information we hold about you.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-lg font-semibold">8. Cookies</h2>
          <p>
            We use essential cookies to keep you signed in securely. We do not use cookies for
            third-party advertising.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-lg font-semibold">9. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will post the updated version on
            this page with a revised &quot;last updated&quot; date.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground text-lg font-semibold">10. Contact us</h2>
          <p>
            If you have questions about this Privacy Policy, please reach out through our{' '}
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
