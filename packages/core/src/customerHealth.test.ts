import { describe, expect, it } from 'vitest';

import { buildCustomerHealthScore } from './customerHealth';

describe('customer health ranking', () => {
  it('marks settled customers with payments as excellent', () => {
    expect(
      buildCustomerHealthScore({
        balance: 0,
        paymentCount: 3,
        totalCredit: 5000,
        totalPayment: 5000,
      })
    ).toMatchObject({
      rank: 'excellent',
      label: 'Excellent',
      tone: 'success',
    });
  });

  it('warns when old dues remain open', () => {
    expect(
      buildCustomerHealthScore({
        balance: 4200,
        daysOutstanding: 38,
        paymentCount: 0,
        totalCredit: 4200,
        totalPayment: 0,
      })
    ).toMatchObject({
      rank: 'high_risk',
      label: 'High risk',
      tone: 'danger',
    });
  });

  it('treats advance balances as healthy rather than risky', () => {
    expect(
      buildCustomerHealthScore({
        balance: -800,
        paymentCount: 1,
        totalCredit: 0,
        totalPayment: 800,
      }).score
    ).toBeGreaterThanOrEqual(88);
  });
});
