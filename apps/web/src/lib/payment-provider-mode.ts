'use client';

import { getPaymentProviderPlan } from '@orbit-ledger/core';

export function getWebPaymentProviderPlan() {
  return getPaymentProviderPlan(process.env.NEXT_PUBLIC_ORBIT_LEDGER_PAYMENT_PROVIDER_MODE);
}
