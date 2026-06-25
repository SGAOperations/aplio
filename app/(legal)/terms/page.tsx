import type { Metadata } from 'next';
import Link from 'next/link';

import { PRIVACY_HREF, TERMS_HREF } from '@/lib/constants';

export const metadata: Metadata = { title: 'Terms of Service' };

// Manually maintained — update when the terms content changes.
const LAST_UPDATED = 'June 25, 2026';

export default function TermsOfServicePage() {
  return (
    <article>
      <h1 className="text-2xl font-semibold tracking-tight">
        Terms of Service
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Last updated: {LAST_UPDATED}
      </p>

      <section>
        <h2 className="mt-8 text-lg font-semibold">1. Acceptance of Terms</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          By accessing or using Aplio, you agree to be bound by these Terms of
          Service. If you do not agree to these terms, do not use the platform.
          These terms apply to all users of the platform, including applicants
          and administrators.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">2. Intended Use</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Aplio is an internal tool designed exclusively for managing
          applications to student government positions. The platform may only be
          used for this purpose. Unauthorized use of the platform for any other
          purpose — including testing, scraping, or circumventing access
          controls — is not permitted.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">3. Accurate Information</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          By submitting an application, you agree that all information you
          provide is truthful, accurate, and complete to the best of your
          knowledge. Submitting false or misleading information in an
          application may result in the rejection or withdrawal of your
          application and may be subject to further action under applicable
          student organization policies.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">
          4. No Guarantee of Acceptance
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Submitting an application through Aplio does not guarantee acceptance
          to any position. All applications are subject to review and evaluation
          by position managers and administrators. Decisions are made at the
          discretion of the student government organization and are final.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">5. Account Termination</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Platform administrators may deactivate or remove accounts at any time,
          including for violation of these Terms of Service or applicable
          student organization policies. If your account is deactivated, you may
          lose access to application records stored on the platform. Contact
          your student government representative if you believe your account was
          deactivated in error.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">
          6. Limitation of Liability
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Aplio is provided as-is for internal organizational use. The student
          government organization and platform maintainers make no warranties,
          express or implied, regarding the availability, reliability, or
          fitness of the platform for any particular purpose. To the maximum
          extent permitted by applicable law, the organization is not liable for
          any loss or damage arising from your use of or inability to use the
          platform.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">
          7. Governing Jurisdiction
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          These Terms of Service are governed by applicable student organization
          policies and any institutional rules of the associated academic
          institution. Disputes arising from the use of this platform will be
          resolved in accordance with those policies.
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
        <Link href="/login" className="hover:text-foreground hover:underline">
          Back to sign in
        </Link>
      </footer>
    </article>
  );
}
