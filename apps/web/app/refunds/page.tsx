import type { Metadata } from 'next';
import { LegalPage } from '../legal-page';

export const metadata: Metadata = {
  title: 'Refund and Cancellation Policy',
  description:
    'Orbit Ledger refund, cancellation, billing support, and public beta policy for subscriptions and paid add-ons.',
  alternates: {
    canonical: '/refunds',
  },
  openGraph: {
    title: 'Orbit Ledger Refund and Cancellation Policy',
    description: 'Refund, cancellation, billing support, and public beta policy for Orbit Ledger.',
    url: '/refunds',
    siteName: 'Orbit Ledger',
    type: 'website',
  },
};

export default function RefundsPage() {
  return (
    <LegalPage
      eyebrow="Billing"
      title="Refund and Cancellation Policy"
      intro="This policy explains how Orbit Ledger handles public beta access, paid plans, cancellations, billing questions, and refund review."
      sections={[
        {
          title: 'Public beta',
          body: (
            <p>
              Orbit Ledger is currently offered as a public beta experience where some functionality
              may be free while we improve the product. If paid plans or add-ons are introduced, the
              purchase flow will show the applicable price, renewal terms, and cancellation path.
            </p>
          ),
        },
        {
          title: 'Cancellation',
          body: (
            <p>
              If you cancel a paid plan, cancellation affects future renewal unless the billing
              screen or support confirmation says otherwise. Your workspace access and export
              options may depend on the plan, billing state, and account status.
            </p>
          ),
        },
        {
          title: 'Refund review',
          body: (
            <p>
              Refunds are reviewed case by case for duplicate charges, failed access after payment,
              incorrect billing, or other verified billing issues. We may ask for account, invoice,
              payment, or workspace details to investigate the request.
            </p>
          ),
        },
        {
          title: 'No forced retention',
          body: (
            <p>
              If you decide to leave Orbit Ledger, we do not force you to stay. We recommend
              exporting business documents and records before account or workspace closure.
            </p>
          ),
        },
        {
          title: 'Billing support',
          body: (
            <p>
              For billing, cancellation, or refund help, contact <a href="mailto:support@orbitledger.rudraix.com">support@orbitledger.rudraix.com</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
