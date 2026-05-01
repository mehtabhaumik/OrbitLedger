'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { normalizeUpiId } from '@orbit-ledger/core';

export default function HostedPaymentPage() {
  return (
    <Suspense fallback={<HostedPaymentShell />}>
      <HostedPaymentContent />
    </Suspense>
  );
}

function HostedPaymentContent() {
  const searchParams = useSearchParams();
  const [copied, setCopied] = useState(false);
  const payment = useMemo(
    () => ({
      invoice: clean(searchParams.get('invoice')) ?? 'Invoice',
      reference: clean(searchParams.get('reference')) ?? clean(searchParams.get('invoice')) ?? 'Invoice payment',
      amount: parseAmount(searchParams.get('amount')),
      currency: clean(searchParams.get('currency'))?.toUpperCase() ?? 'INR',
      business: clean(searchParams.get('business')) ?? 'Orbit Ledger business',
      customer: clean(searchParams.get('customer')),
      due: clean(searchParams.get('due')),
      upi: normalizeUpiId(searchParams.get('upi')),
      note: clean(searchParams.get('note')),
    }),
    [searchParams]
  );
  const hasAmount = payment.amount > 0;
  const upiUrl = payment.upi
    ? buildUpiUrl({
        upiId: payment.upi,
        business: payment.business,
        amount: payment.amount,
        currency: payment.currency,
        reference: payment.reference,
        note: payment.note,
      })
    : null;

  async function copyPaymentDetails() {
    await navigator.clipboard.writeText(
      [
        `Business: ${payment.business}`,
        payment.customer ? `Customer: ${payment.customer}` : null,
        `Invoice: ${payment.invoice}`,
        `Amount: ${formatCurrency(payment.amount, payment.currency)}`,
        `Reference: ${payment.reference}`,
        payment.upi ? `UPI: ${payment.upi}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main className="ol-pay-page">
      <section className="ol-pay-shell">
        <div className="ol-pay-brand">
          <img alt="Orbit Ledger" src="/branding/orbit-ledger-logo-transparent.png" />
        </div>
        <div className="ol-pay-grid">
          <article className="ol-pay-card ol-pay-card--hero">
            <span className="ol-pay-kicker">Invoice payment</span>
            <h1>{formatCurrency(payment.amount, payment.currency)}</h1>
            <p>{payment.business}</p>
            <div className="ol-pay-reference">
              <span>Reference</span>
              <strong>{payment.reference}</strong>
            </div>
            <div className="ol-pay-notice">
              This page shows payment instructions from the business. Orbit Ledger does not process or confirm this payment.
            </div>
            <div className="ol-pay-actions">
              {upiUrl && hasAmount ? (
                <a className="ol-button" href={upiUrl}>
                  Pay with UPI
                </a>
              ) : null}
              <button className="ol-button-secondary" type="button" onClick={() => void copyPaymentDetails()}>
                {copied ? 'Copied' : 'Copy details'}
              </button>
            </div>
          </article>

          <article className="ol-pay-card">
            <h2>Payment Details</h2>
            <div className="ol-pay-detail-list">
              <PaymentDetail label="Invoice" value={payment.invoice} />
              <PaymentDetail label="Customer" value={payment.customer ?? 'Not provided'} />
              <PaymentDetail label="Due date" value={payment.due ?? 'Not provided'} />
              <PaymentDetail label="Amount" value={formatCurrency(payment.amount, payment.currency)} />
              <PaymentDetail label="UPI" value={payment.upi ?? 'Not provided'} />
              <PaymentDetail label="Note" value={payment.note ?? 'Keep the reference unchanged.'} />
            </div>
          </article>

          <article className="ol-pay-card ol-pay-card--steps">
            <h2>After payment</h2>
            <ol className="ol-pay-steps">
              <li>Pay the exact amount shown here.</li>
              <li>Keep the reference unchanged.</li>
              <li>Share the payment confirmation with the business.</li>
            </ol>
          </article>
        </div>
        <p className="ol-pay-footer">
          Generated using Orbit Ledger. Keep the payment reference unchanged so the business can match your
          payment quickly.
        </p>
      </section>
    </main>
  );
}

function HostedPaymentShell() {
  return (
    <main className="ol-pay-page">
      <section className="ol-pay-shell">
        <article className="ol-pay-card">
          <h1>Loading payment details</h1>
        </article>
      </section>
    </main>
  );
}

function PaymentDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="ol-pay-detail">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function clean(value: string | null): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function parseAmount(value: string | null): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function buildUpiUrl(input: {
  upiId: string;
  business: string;
  amount: number;
  currency: string;
  reference: string;
  note: string | null;
}) {
  const url = new URL('upi://pay');
  url.searchParams.set('pa', input.upiId);
  url.searchParams.set('pn', input.business);
  url.searchParams.set('am', input.amount.toFixed(2));
  url.searchParams.set('cu', input.currency);
  url.searchParams.set('tn', input.note ?? input.reference);
  return url.toString();
}
