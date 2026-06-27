import type { Metadata } from 'next';
import Link from 'next/link';

import { PRIVACY_HREF, TERMS_HREF } from '@/lib/constants';

export const metadata: Metadata = { title: 'Privacy Policy' };

// Manually maintained — update when the policy content changes.
const LAST_UPDATED = 'June 25, 2026';

export default function PrivacyPolicyPage() {
  return (
    <article>
      <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Last updated: {LAST_UPDATED}
      </p>

      <section>
        <h2 className="mt-8 text-lg font-semibold">
          1. Information We Collect
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Aplio collects the following information when you use the platform:
        </p>
        <ul className="text-muted-foreground mt-2 list-disc pl-6 text-sm leading-relaxed">
          <li>
            <strong className="text-foreground">Name and email address</strong>{' '}
            — provided through Neon Auth when you sign in with a one-time code.
          </li>
          <li>
            <strong className="text-foreground">Application responses</strong> —
            the answers you submit to global and position-specific questions
            when applying to student government positions.
          </li>
          <li>
            <strong className="text-foreground">
              Application status and review history
            </strong>{' '}
            — records of the status changes your applications go through during
            the review process.
          </li>
        </ul>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          We do not collect payment information, location data, or any
          information beyond what is necessary to manage the application
          process.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">2. How We Use It</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          The information collected is used solely to operate Aplio as an
          internal student government application management tool:
        </p>
        <ul className="text-muted-foreground mt-2 list-disc pl-6 text-sm leading-relaxed">
          <li>
            Reviewing your applications for student government positions you
            have applied to.
          </li>
          <li>
            Communicating with you about the status of your application,
            including interview scheduling and final decisions.
          </li>
          <li>
            Maintaining a record of positions and cycles for administrative
            purposes.
          </li>
        </ul>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Your information is never used for advertising, marketing, or sold to
          third parties.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">3. Who Can See It</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Access to your information is scoped to the minimum necessary:
        </p>
        <ul className="text-muted-foreground mt-2 list-disc pl-6 text-sm leading-relaxed">
          <li>
            <strong className="text-foreground">You</strong> can view your own
            applications, responses, and status history at any time.
          </li>
          <li>
            <strong className="text-foreground">Position managers</strong> can
            see applications submitted to the specific positions they manage.
            They cannot see your applications to other positions.
          </li>
          <li>
            <strong className="text-foreground">Platform admins</strong> can see
            all applications and user records in order to operate and maintain
            the system.
          </li>
        </ul>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          No other users can view your application responses.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">4. Data Retention</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Application records are retained for the duration of the program and
          for a reasonable period thereafter for historical reference. If you
          would like your account or application data deleted, please contact
          your student government representative (see Section 6). We will
          process deletion requests in accordance with applicable organizational
          policies.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">5. Third-Party Services</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Aplio uses the following third-party services to operate:
        </p>
        <ul className="text-muted-foreground mt-2 list-disc pl-6 text-sm leading-relaxed">
          <li>
            <strong className="text-foreground">Neon Auth</strong> — handles
            authentication via one-time email codes. Your email address is
            shared with Neon to verify your identity. Neon&apos;s privacy policy
            governs how they handle authentication data.
          </li>
          <li>
            <strong className="text-foreground">Vercel</strong> — hosts the
            Aplio platform. Application data is stored and processed on
            Vercel&apos;s infrastructure. Vercel&apos;s privacy policy governs
            their infrastructure handling.
          </li>
        </ul>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          No other third-party services receive your personal information.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">6. Contact</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          If you have questions about this Privacy Policy or would like to
          request deletion of your data, please contact your student government
          representative through your organization&apos;s standard communication
          channels.
        </p>
      </section>

      <footer className="border-border text-muted-foreground mt-12 flex flex-wrap items-center gap-x-2 border-t pt-6 text-xs">
        <Link
          href={PRIVACY_HREF}
          className="hover:text-foreground hover:underline"
        >
          Privacy Policy
        </Link>
        <span aria-hidden>·</span>
        <Link
          href={TERMS_HREF}
          className="hover:text-foreground hover:underline"
        >
          Terms of Service
        </Link>
        <span aria-hidden>·</span>
        <Link href="/" className="hover:text-foreground hover:underline">
          Back to home
        </Link>
      </footer>
    </article>
  );
}
