'use client';

import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { summarizePaymentClearance, summarizePaymentMode } from '@orbit-ledger/core';

import type { ProductReorderSuggestion } from '@/lib/workspace-products';
import type { WorkspaceCustomer, WorkspaceInvoice, WorkspaceManualPaymentReviewItem } from '@/lib/workspace-data';

export function ActionableCustomerDialog({
  currency,
  customers,
  emptyCopy = 'No customers need action right now.',
  isOpen,
  onClose,
  subtitle,
  title,
}: {
  currency: string;
  customers: WorkspaceCustomer[];
  emptyCopy?: string;
  isOpen: boolean;
  onClose(): void;
  subtitle: string;
  title: string;
}) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="ol-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-modal="true"
        className="ol-dialog-card"
        role="dialog"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="ol-dialog-header">
          <div>
            <div className="ol-panel-title">{title}</div>
            <p className="ol-panel-copy">{subtitle}</p>
          </div>
          <button className="ol-button-ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="ol-dialog-list">
          {customers.length ? (
            customers.map((customer) => (
              <article className="ol-dialog-customer" key={customer.id}>
                <div className="ol-list-icon">{customer.name.charAt(0).toUpperCase() || 'C'}</div>
                <div className="ol-dialog-customer-main">
                  <strong>{customer.name}</strong>
                  <span>{customer.phone || customer.email || 'No contact detail added'}</span>
                  <small>{customer.health.helper}</small>
                </div>
                <div className="ol-dialog-customer-meta">
                  <span className={`ol-chip ol-chip--${customer.health.tone === 'danger' ? 'warning' : customer.health.tone}`}>
                    {customer.health.label}
                  </span>
                  <strong className="ol-amount">{formatCurrency(customer.balance, currency)}</strong>
                </div>
                <Link
                  className="ol-button-secondary"
                  href={`/customers/detail?customerId=${encodeURIComponent(customer.id)}` as Route}
                  onClick={onClose}
                >
                  Open customer
                </Link>
              </article>
            ))
          ) : (
            <div className="ol-empty">{emptyCopy}</div>
          )}
        </div>
      </section>
    </div>
  );
}

export function ActionableInvoiceDialog({
  currency,
  emptyCopy = 'No invoices need action right now.',
  invoices,
  isOpen,
  onClose,
  subtitle,
  title,
}: {
  currency: string;
  emptyCopy?: string;
  invoices: WorkspaceInvoice[];
  isOpen: boolean;
  onClose(): void;
  subtitle: string;
  title: string;
}) {
  useDialogEscape(isOpen, onClose);

  if (!isOpen) {
    return null;
  }

  return (
    <DialogFrame onClose={onClose} title={title} subtitle={subtitle}>
      <div className="ol-dialog-list">
        {invoices.length ? (
          invoices.map((invoice) => (
            <article className="ol-dialog-customer" key={invoice.id}>
              <div className="ol-list-icon">I</div>
              <div className="ol-dialog-customer-main">
                <strong>{invoice.invoiceNumber}</strong>
                <span>{invoice.customerName || 'Unlinked customer'}</span>
                <small>{invoice.issueDate} · {invoice.documentState.replace(/_/g, ' ')}</small>
              </div>
              <div className="ol-dialog-customer-meta">
                <span className={`ol-chip ol-chip--${invoice.paymentStatus === 'paid' ? 'success' : 'warning'}`}>
                  {invoice.paymentStatus.replace(/_/g, ' ')}
                </span>
                <strong className="ol-amount">{formatCurrency(invoice.totalAmount, currency)}</strong>
              </div>
              <Link
                className="ol-button-secondary"
                href={`/invoices/detail?invoiceId=${encodeURIComponent(invoice.id)}` as Route}
                onClick={onClose}
              >
                Open invoice
              </Link>
            </article>
          ))
        ) : (
          <div className="ol-empty">{emptyCopy}</div>
        )}
      </div>
    </DialogFrame>
  );
}

export function ActionableProductDialog({
  currency,
  emptyCopy = 'No products need action right now.',
  isOpen,
  onClose,
  subtitle,
  suggestions,
  title,
}: {
  currency: string;
  emptyCopy?: string;
  isOpen: boolean;
  onClose(): void;
  subtitle: string;
  suggestions: ProductReorderSuggestion[];
  title: string;
}) {
  useDialogEscape(isOpen, onClose);

  if (!isOpen) {
    return null;
  }

  return (
    <DialogFrame onClose={onClose} title={title} subtitle={subtitle}>
      <div className="ol-dialog-list">
        {suggestions.length ? (
          suggestions.map((suggestion) => (
            <article className="ol-dialog-customer" key={suggestion.product.id}>
              <div className="ol-list-icon">P</div>
              <div className="ol-dialog-customer-main">
                <strong>{suggestion.product.name}</strong>
                <span>
                  {suggestion.product.stockQuantity} {suggestion.product.unit} in stock
                </span>
                <small>{suggestion.reason}</small>
              </div>
              <div className="ol-dialog-customer-meta">
                <span className={`ol-chip ol-chip--${suggestion.urgency === 'watch' ? 'primary' : 'warning'}`}>
                  {suggestion.urgencyLabel}
                </span>
                <strong className="ol-amount">{formatCurrency(suggestion.estimatedReorderCost, currency)}</strong>
              </div>
              <Link className="ol-button-secondary" href={'/products' as Route} onClick={onClose}>
                Open products
              </Link>
            </article>
          ))
        ) : (
          <div className="ol-empty">{emptyCopy}</div>
        )}
      </div>
    </DialogFrame>
  );
}

export function ActionablePaymentDialog({
  currency,
  emptyCopy = 'No payments need review right now.',
  isOpen,
  onClose,
  payments,
  subtitle,
  title,
}: {
  currency: string;
  emptyCopy?: string;
  isOpen: boolean;
  onClose(): void;
  payments: WorkspaceManualPaymentReviewItem[];
  subtitle: string;
  title: string;
}) {
  useDialogEscape(isOpen, onClose);

  if (!isOpen) {
    return null;
  }

  return (
    <DialogFrame onClose={onClose} title={title} subtitle={subtitle}>
      <div className="ol-dialog-list">
        {payments.length ? (
          payments.map((payment) => (
            <article className="ol-dialog-customer" key={`${payment.transactionId}-${payment.allocationId ?? 'ledger'}`}>
              <div className="ol-list-icon">P</div>
              <div className="ol-dialog-customer-main">
                <strong>{payment.customerName}</strong>
                <span>
                  {summarizePaymentMode(payment.paymentMode, payment.paymentDetails)} ·{' '}
                  {summarizePaymentClearance(payment.paymentClearanceStatus, payment.paymentDetails)}
                </span>
                <small>
                  {payment.invoiceNumber ? `Invoice ${payment.invoiceNumber}` : 'Customer ledger payment'} ·{' '}
                  {payment.effectiveDate || payment.createdAt.slice(0, 10)}
                </small>
              </div>
              <div className="ol-dialog-customer-meta">
                <span className="ol-chip ol-chip--warning">
                  {payment.paymentClearanceStatus.replace(/_/g, ' ')}
                </span>
                <strong className="ol-amount">{formatCurrency(payment.amount, currency)}</strong>
              </div>
              <Link className="ol-button-secondary" href={'/payments' as Route} onClick={onClose}>
                Open payments
              </Link>
            </article>
          ))
        ) : (
          <div className="ol-empty">{emptyCopy}</div>
        )}
      </div>
    </DialogFrame>
  );
}

function DialogFrame({
  children,
  onClose,
  subtitle,
  title,
}: {
  children: ReactNode;
  onClose(): void;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="ol-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-modal="true"
        className="ol-dialog-card"
        role="dialog"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="ol-dialog-header">
          <div>
            <div className="ol-panel-title">{title}</div>
            <p className="ol-panel-copy">{subtitle}</p>
          </div>
          <button className="ol-button-ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function useDialogEscape(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
