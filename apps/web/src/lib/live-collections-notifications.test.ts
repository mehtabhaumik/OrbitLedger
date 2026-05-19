import { describe, expect, it } from 'vitest';

import {
  formatLiveCollectionAmount,
  parseLiveCollectionNotification,
  shouldSurfaceLiveCollectionNotification,
} from './live-collections-notifications';

describe('live collections notifications', () => {
  it('parses backend-owned payment notifications without provider details', () => {
    const notification = parseLiveCollectionNotification('notif_1', {
      kind: 'payment_received',
      title: 'Payment received',
      message: 'INR 1770.00 received for invoice INV-1.',
      amount: 1770,
      currency: 'inr',
      invoice_id: 'invoice-1',
      customer_id: 'customer-1',
      deep_link_path: '/invoices/detail/?invoiceId=invoice-1',
      created_at: '2026-05-20T10:00:00.000Z',
      provider_payment_id: 'pay_hidden',
    });

    expect(notification).toMatchObject({
      id: 'notif_1',
      kind: 'payment_received',
      tone: 'success',
      amount: 1770,
      currency: 'INR',
      invoiceId: 'invoice-1',
      customerId: 'customer-1',
      deepLinkPath: '/invoices/detail/?invoiceId=invoice-1',
    });
    expect(JSON.stringify(notification)).not.toContain('pay_hidden');
  });

  it('normalizes unsafe deep links to the payments page', () => {
    const notification = parseLiveCollectionNotification('notif_2', {
      kind: 'payment_failed',
      message: 'Payment failed.',
      amount: 500,
      currency: 'INR',
      deep_link_path: 'https://example.test/bad',
      created_at: '2026-05-20T10:00:00.000Z',
    });

    expect(notification?.deepLinkPath).toBe('/payments');
    expect(notification?.tone).toBe('danger');
  });

  it('keeps provider wording out of customer-facing feed copy', () => {
    const notification = parseLiveCollectionNotification('notif_provider_wording', {
      kind: 'payment_needs_review',
      message: 'Razorpay payment status failed needs attention.',
      amount: 500,
      currency: 'INR',
      deep_link_path: '/payments',
      created_at: '2026-05-20T10:00:00.000Z',
    });

    expect(notification?.message).toBe('online payment status failed needs attention.');
  });

  it('surfaces only new unshown notifications', () => {
    const notification = parseLiveCollectionNotification('notif_3', {
      kind: 'payment_received',
      message: 'Payment received.',
      amount: 100,
      currency: 'INR',
      deep_link_path: '/payments',
      created_at: '2026-05-20T10:00:05.000Z',
    });

    expect(notification).not.toBeNull();
    expect(
      shouldSurfaceLiveCollectionNotification({
        notification: notification!,
        knownIds: new Set(),
        mountedAtMs: Date.parse('2026-05-20T10:00:00.000Z'),
        nowMs: Date.parse('2026-05-20T10:00:10.000Z'),
      })
    ).toBe(true);
    expect(
      shouldSurfaceLiveCollectionNotification({
        notification: notification!,
        knownIds: new Set(['notif_3']),
        mountedAtMs: Date.parse('2026-05-20T10:00:00.000Z'),
        nowMs: Date.parse('2026-05-20T10:00:10.000Z'),
      })
    ).toBe(false);
  });

  it('formats collection amounts for invoice notifications', () => {
    expect(formatLiveCollectionAmount(1770, 'INR')).toContain('1,770');
    expect(formatLiveCollectionAmount(null, 'INR')).toBeNull();
  });
});
