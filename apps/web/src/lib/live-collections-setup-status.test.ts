import { describe, expect, it } from 'vitest';

import { buildWebLiveCollectionsSetupStatus } from './live-collections-setup-status';

describe('web live collections setup status', () => {
  it('keeps manual-mode online collections safe and non-mutating', () => {
    const status = buildWebLiveCollectionsSetupStatus({ mode: 'manual' });

    expect(status).toMatchObject({
      collectionMode: 'manual',
      badge: 'Setup required',
      safeForCustomerUi: true,
      exposesSecrets: false,
      allowsPaymentMutation: false,
    });
    expect(status.message).toContain('Manual UPI and bank details remain available');
  });

  it('allows test setup copy without exposing provider secrets', () => {
    const status = buildWebLiveCollectionsSetupStatus({ mode: 'razorpay_test_ready' });
    const copy = [status.title, status.message, ...status.detailItems].join('\n');

    expect(status).toMatchObject({
      collectionMode: 'razorpay_test_ready',
      badge: 'Ready for test',
      allowsPaymentMutation: false,
    });
    expect(copy).not.toMatch(/RAZORPAY_KEY_ID|RAZORPAY_KEY_SECRET|RAZORPAY_WEBHOOK_SECRET|secret manager/i);
  });

  it('shows connected setup as review-ready without giving the browser payment authority', () => {
    const status = buildWebLiveCollectionsSetupStatus({ mode: 'razorpay_connected' });

    expect(status).toMatchObject({
      collectionMode: 'razorpay_connected',
      badge: 'Pilot review ready',
      tone: 'success',
      exposesSecrets: false,
      allowsPaymentMutation: false,
    });
    expect(status.detailItems).toContain('Continue storing every automated payment update in audit history.');
  });
});
