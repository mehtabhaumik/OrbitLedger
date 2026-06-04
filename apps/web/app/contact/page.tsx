import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '../legal-page';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contact Orbit Ledger for support, billing, privacy, account access, and business workspace questions.',
  alternates: {
    canonical: '/contact',
  },
  openGraph: {
    title: 'Contact Orbit Ledger',
    description: 'Contact Orbit Ledger support for account, billing, privacy, and workspace help.',
    url: '/contact',
    siteName: 'Orbit Ledger',
    type: 'website',
  },
};

export default function ContactPage() {
  return (
    <LegalPage
      eyebrow="Contact"
      title="Contact Orbit Ledger"
      intro="Use this page to reach Orbit Ledger for support, billing, privacy, account access, workspace, or verification questions."
      sections={[
        {
          title: 'Support email',
          body: (
            <p>
              Email <a href="mailto:support@orbitledger.rudraix.com">support@orbitledger.rudraix.com</a> for product support,
              billing questions, privacy requests, account access help, workspace closure, and
              verification questions.
            </p>
          ),
        },
        {
          title: 'Signed-in support',
          body: (
            <p>
              If you can sign in, use the in-app support center so your request can include the
              correct workspace context and optional diagnostics.
            </p>
          ),
        },
        {
          title: 'Response context',
          body: (
            <p>
              When contacting us, include the email you use for Orbit Ledger, the workspace or
              business name, the affected invoice or payment reference if relevant, and a short
              description of the issue.
            </p>
          ),
        },
      ]}
    >
      <div className="ol-public-actions">
        <Link className="ol-button" href="/login">
          Sign in for support
        </Link>
        <a className="ol-button-secondary" href="mailto:support@orbitledger.rudraix.com">
          Email support
        </a>
      </div>
    </LegalPage>
  );
}
