import type { Metadata } from 'next';
import Link from 'next/link';

import { PRIVACY_HREF, TERMS_HREF } from '@/lib/constants';

export const metadata: Metadata = { title: 'Terms of Service' };

// Manually maintained — update when the terms content changes.
const LAST_UPDATED = 'June 28, 2026';

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
        <h2 className="mt-8 text-lg font-semibold">1. About Aplio</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Aplio is a student government application platform operated by the
          Northeastern University Student Government Association (the
          &ldquo;SGA&rdquo;). In these Terms, &ldquo;we&rdquo; and
          &ldquo;us&rdquo; refer to the SGA. &ldquo;You&rdquo; refers to anyone
          who creates an account or uses the platform.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">2. Acceptance</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          By creating an account on Aplio, you agree to these Terms of Service
          and the Aplio Privacy Policy. If you do not agree, do not create an
          account or use the platform. These Terms apply to all users —
          applicants, position managers, and administrators alike.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">3. Intended Use</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Aplio is built for one purpose: managing applications to student
          government positions within the SGA. You may only use the platform for
          that purpose.
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          The following are not allowed:
        </p>
        <ul className="text-muted-foreground mt-2 list-disc pl-6 text-sm leading-relaxed">
          <li>
            Using the platform for anything unrelated to student government
            applications.
          </li>
          <li>
            Scraping, crawling, or extracting data from the platform by
            automated means.
          </li>
          <li>
            Trying to bypass, disable, or interfere with any access controls or
            security features.
          </li>
          <li>
            Sharing your account credentials or accessing someone else&apos;s
            account.
          </li>
          <li>
            Using or sharing another user&apos;s application data outside the
            platform, or for any purpose other than evaluating their candidacy
            for a position they applied to.
          </li>
          <li>
            Using the platform in a way that violates applicable law or
            Northeastern University policies.
          </li>
        </ul>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          These rules apply to administrators too. Administrators may not
          configure the platform in ways that break the law — for example, by
          creating questions that ask applicants about protected characteristics
          such as race, religion, national origin, sex, disability, or age where
          that would be unlawful.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">4. User Representations</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Applicants confirm that everything they submit in an application is
          truthful, accurate, and complete to the best of their knowledge.
          Submitting false or misleading information may result in rejection or
          withdrawal of an application and may be referred for further action
          under SGA or university policies.
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Administrators confirm that they are authorized by the SGA to create
          and manage positions on the platform, and that they will only use
          their access for legitimate SGA purposes.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">
          5. No Guarantee of Acceptance
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Applying through Aplio does not guarantee you will be accepted to any
          position. All applications are reviewed and evaluated by position
          managers and administrators. Decisions are made at the SGA&apos;s
          discretion and are final.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">6. Account Termination</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Administrators may deactivate or remove accounts at any time,
          including for violations of these Terms or applicable SGA or
          university policies. If your account is deactivated, you may lose
          access to your application records on the platform. You can still
          request access to your personal data after deactivation by emailing{' '}
          <Link
            href="mailto:sgaOperations@northeastern.edu"
            className="text-primary hover:underline"
          >
            sgaOperations@northeastern.edu
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">
          7. Branding and Intellectual Property
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          The Aplio name, logo, and visual identity belong to the SGA. You may
          not use them in connection with any other platform, product, or
          service without our permission.
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          The Aplio software is proprietary. Copyright &copy; 2026 Northeastern
          University Student Government Association. All rights reserved. No
          use, copying, modification, or distribution of this software is
          permitted without prior written permission from the copyright holder.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">8. Service Availability</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          We do not guarantee that Aplio will be available at any particular
          time. The platform may go down for maintenance or other reasons, with
          or without notice, and may be discontinued at any time.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">
          9. Limitation of Liability
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Aplio is provided as-is. The SGA and its officers, members, and
          platform administrators make no warranties — express or implied —
          about the platform&apos;s availability, reliability, accuracy, or
          fitness for any particular purpose. To the maximum extent permitted by
          applicable law, none of them are liable for any loss or damage arising
          from your use of or inability to use the platform.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">
          10. Changes to These Terms
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          We may update these Terms from time to time. When we do, we will
          update the date at the top and email active users to describe what
          changed. Continuing to use Aplio after that notice means you accept
          the updated Terms.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">11. Severability</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          If any part of these Terms is found to be unenforceable, that part
          will be modified or removed to the minimum extent necessary. The rest
          of the Terms will remain in effect.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">12. Governing Law</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          These Terms are governed by the laws of the Commonwealth of
          Massachusetts.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">13. Contact</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Questions about these Terms? Contact us at:
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Aplio / Student Government Operations
          <br />
          <Link
            href="mailto:sgaOperations@northeastern.edu"
            className="text-primary hover:underline"
          >
            sgaOperations@northeastern.edu
          </Link>
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          These Terms apply to the Aplio platform operated by the Northeastern
          University Student Government Association.
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
