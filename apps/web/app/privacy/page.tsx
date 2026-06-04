import type { Metadata } from 'next';
import { LegalPage } from '../legal-page';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Orbit Ledger privacy policy for account, workspace, support, billing, and document data handled by the Orbit Ledger web app.',
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    title: 'Orbit Ledger Privacy Policy',
    description:
      'How Orbit Ledger handles account, workspace, support, billing, and document data.',
    url: '/privacy',
    siteName: 'Orbit Ledger',
    type: 'website',
  },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy Policy"
      intro="Orbit Ledger is built for sensitive business records. This policy explains what we collect, why we collect it, and how we protect workspace data."
      sections={[
        {
          title: 'Information we collect',
          body: (
            <p>
              We collect account details, sign-in provider information, workspace profile details,
              customer and invoice records, payment and collection records, uploaded proofs,
              support messages, diagnostics you approve, and billing or subscription events needed
              to operate Orbit Ledger.
            </p>
          ),
        },
        {
          title: 'How we use information',
          body: (
            <p>
              We use this information to provide the Orbit Ledger app, secure sign-in, workspace
              access, invoices, statements, payment follow-up, support, audit history, billing
              operations, abuse prevention, and service improvements.
            </p>
          ),
        },
        {
          title: 'Google sign-in and connected services',
          body: (
            <p>
              If you use Google sign-in, Orbit Ledger receives basic profile information such as
              your email address and account identifier so we can authenticate you and connect you
              to the correct workspace. We do not ask for your Google password.
            </p>
          ),
        },
        {
          title: 'Support and diagnostics',
          body: (
            <p>
              Support diagnostics are only used to understand and resolve product issues. When the
              app asks for privacy review, diagnostic details are shown before they are submitted.
            </p>
          ),
        },
        {
          title: 'Sharing and processors',
          body: (
            <p>
              We do not sell customer data. We may use trusted service providers for hosting,
              authentication, email delivery, payments, analytics, support, storage, and security.
              These providers process data only to help us operate Orbit Ledger.
            </p>
          ),
        },
        {
          title: 'Retention and account closure',
          body: (
            <p>
              Workspace records are kept while needed for product operation, legal, billing,
              support, audit, and safety reasons. If you request account or workspace closure, we
              may retain limited records where required for compliance, security, dispute handling,
              or fraud prevention.
            </p>
          ),
        },
        {
          title: 'Contact',
          body: (
            <p>
              For privacy questions, contact <a href="mailto:support@orbitledger.rudraix.com">support@orbitledger.rudraix.com</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
