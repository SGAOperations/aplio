import type { Metadata } from 'next';
import Link from 'next/link';

import { PRIVACY_HREF, TERMS_HREF } from '@/lib/constants';

export const metadata: Metadata = { title: 'Privacy Policy' };

// Manually maintained — update when the policy content changes.
const LAST_UPDATED = 'June 28, 2026';

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
            <strong className="text-foreground">Full name</strong> — entered by
            you during account setup.
          </li>
          <li>
            <strong className="text-foreground">Email address</strong> —
            verified through Neon Auth, which maintains your authentication
            identity and session on our behalf.
          </li>
          <li>
            <strong className="text-foreground">Application responses</strong> —
            the answers you submit when applying to student government
            positions. The specific questions asked vary by position and are
            configured by student government administrators. They may include
            open-ended questions, requests for prior experience, and other
            information relevant to the role. You will see all questions before
            submitting.
          </li>
          <li>
            <strong className="text-foreground">
              Application status and review history
            </strong>{' '}
            — records of the status changes your applications go through during
            the review process.
          </li>
          <li>
            <strong className="text-foreground">Technical and log data</strong>{' '}
            — basic information such as IP addresses, browser type, and request
            timestamps that may be logged automatically by our hosting
            infrastructure (Vercel) as part of normal platform operations. See
            Section 5 for details.
          </li>
        </ul>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          We do not collect payment information or precise location data. The
          only personal information we collect beyond what is listed above is
          whatever you choose to provide in response to administrator-configured
          application questions.
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          <strong className="text-foreground">
            A note on admin-configured questions:
          </strong>{' '}
          Student government administrators can create custom application
          questions for each position. Aplio does not prescribe or review the
          content of these questions. If you are asked for information you are
          not comfortable providing, you may decline to answer or choose not to
          submit the application.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">
          2. How We Use Your Information
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          The information collected is used solely to operate Aplio as a student
          government application management tool:
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
            Maintaining a permanent record of positions and application cycles
            for administrative purposes.
          </li>
        </ul>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Your information is never used for advertising, marketing, or sold to
          third parties. Reviewers and administrators who access your
          information through Aplio are bound by the same use limitations
          described in this policy — your application responses may only be used
          to evaluate your candidacy for the positions you applied to.
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          <strong className="text-foreground">
            Legal basis for processing:
          </strong>{' '}
          We process your information because you have voluntarily submitted an
          application for a student government position, and processing is
          necessary to evaluate and administer that application.
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          <strong className="text-foreground">
            Automated decision-making:
          </strong>{' '}
          We do not use automated decision-making or profiling in evaluating
          applications. All application reviews involve human judgment.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">
          3. Who Can See Your Information
        </h2>
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
            see applications submitted only to the specific positions they have
            been assigned to manage. They cannot see your applications to any
            other positions.
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
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          In addition to the roles above, your data is technically processed by
          our infrastructure providers as described in Section 5. Those
          providers operate under contractual data protection obligations and do
          not use your data for their own purposes.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">4. Data Retention</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Application records, including your name, email address, responses,
          and status history, are retained indefinitely to support the permanent
          historical record of student government operations. We do not delete
          individual application records.
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          If you have questions about what data we hold about you, or wish to
          request access to your records, please contact us at{' '}
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
        <h2 className="mt-8 text-lg font-semibold">5. Third-Party Services</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Aplio uses the following third-party services to operate:
        </p>
        <ul className="text-muted-foreground mt-2 list-disc pl-6 text-sm leading-relaxed">
          <li>
            <strong className="text-foreground">Neon Auth</strong> — manages
            authentication directly on our behalf, including verifying your
            email address via one-time code and maintaining your identity record
            and session credentials. Neon is a US-based company whose
            infrastructure runs on AWS. Neon&apos;s privacy policy and Data
            Processing Agreement govern how they handle authentication data.
          </li>
          <li>
            <strong className="text-foreground">Neon (database)</strong> — hosts
            our application database directly. All application records,
            responses, and user data are stored in a Neon-managed PostgreSQL
            database. Neon operates as a direct data processor for Aplio under
            its own Data Processing Agreement. Neon&apos;s infrastructure runs
            on AWS.
          </li>
          <li>
            <strong className="text-foreground">Vercel</strong> — hosts and
            serves the Aplio web application. Vercel processes request and log
            data as part of normal platform operations. Vercel is a US-based
            company and operates under its own privacy policy and Data
            Processing Agreement.
          </li>
        </ul>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          All data is stored and processed on servers located in the United
          States. Neon and Vercel each operate as independent direct processors
          for Aplio.
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          No other third-party services receive your personal information.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">
          6. Security and Data Breaches
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          We implement reasonable technical and organizational measures to
          protect your personal information. Access to data is restricted by
          role as described in Section 3, and data is encrypted in transit via
          our hosting infrastructure.
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          In the event of a security breach affecting your personal information,
          we will notify affected users as soon as practicable and report to the
          relevant Massachusetts authorities — including the Office of the
          Attorney General and the Office of Consumer Affairs and Business
          Regulation — as required by M.G.L. Chapter 93H.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">7. Your Rights</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          You may contact us at any time to request access to the personal
          information we hold about you, or to request a correction of
          inaccurate information. We retain all application records indefinitely
          and do not fulfill deletion requests.
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          To submit a request, contact us at{' '}
          <Link
            href="mailto:sgaOperations@northeastern.edu"
            className="text-primary hover:underline"
          >
            sgaOperations@northeastern.edu
          </Link>
          . We will respond within 30 days.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">8. Policy Updates</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          We may update this Privacy Policy from time to time. When we do, we
          will update the &ldquo;Last updated&rdquo; date at the top of this
          policy and notify active users by email describing the nature of any
          material changes. Continued use of Aplio after notification of a
          material change constitutes acceptance of the updated policy.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">9. Contact</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          If you have questions about this Privacy Policy or your personal data,
          please contact:
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Aplio / Student Government Operations
          <br />
          Email:{' '}
          <Link
            href="mailto:sgaOperations@northeastern.edu"
            className="text-primary hover:underline"
          >
            sgaOperations@northeastern.edu
          </Link>
          <br />
          Response time: Within 30 days of receipt
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          This policy applies to the Aplio platform operated by the Northeastern
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
