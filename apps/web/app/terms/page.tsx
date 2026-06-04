import type { Metadata } from 'next';
import { LegalPage } from '../legal-page';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Orbit Ledger terms of service covering workspace use, account responsibilities, subscriptions, support, and acceptable use.',
  alternates: {
    canonical: '/terms',
  },
  openGraph: {
    title: 'Orbit Ledger Terms of Service',
    description: 'Terms for using Orbit Ledger business workspace software.',
    url: '/terms',
    siteName: 'Orbit Ledger',
    type: 'website',
  },
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="Terms of Service"
      intro="These terms describe the rules for using Orbit Ledger, including account access, workspace responsibility, billing, support, and acceptable use."
      sections={[
        {
          title: 'Using Orbit Ledger',
          body: (
            <p>
              Orbit Ledger provides business tools for invoices, receivables, customer follow-up,
              statements, reporting, backups, support, and related workspace operations. You are
              responsible for keeping your account secure and for the records entered into your
              workspace.
            </p>
          ),
        },
        {
          title: 'Workspace ownership and roles',
          body: (
            <p>
              Workspace owners and authorized admins control business records, team access, and
              workspace settings. Team members must only access workspaces and data they are
              authorized to use.
            </p>
          ),
        },
        {
          title: 'Business records',
          body: (
            <p>
              Orbit Ledger helps prepare operational records, but you remain responsible for
              reviewing invoices, tax details, payment status, exports, and reports before using
              them for accounting, legal, tax, or customer-facing purposes.
            </p>
          ),
        },
        {
          title: 'Acceptable use',
          body: (
            <p>
              You must not use Orbit Ledger to store unlawful content, send abusive messages,
              misrepresent payment or invoice records, interfere with service operation, or attempt
              to access another user&apos;s workspace without permission.
            </p>
          ),
        },
        {
          title: 'Public beta and subscriptions',
          body: (
            <p>
              Orbit Ledger may offer free public beta access and later introduce paid plans. If a
              paid plan applies, pricing, renewal, cancellation, and access details will be shown
              before purchase or plan changes.
            </p>
          ),
        },
        {
          title: 'Service changes',
          body: (
            <p>
              We may improve, change, limit, or discontinue parts of the service when needed for
              product quality, security, compliance, or operational reasons. We aim to avoid
              disrupting active business work wherever reasonably possible.
            </p>
          ),
        },
        {
          title: 'Contact',
          body: (
            <p>
              For terms or account questions, contact <a href="mailto:support@orbitledger.rudraix.com">support@orbitledger.rudraix.com</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
