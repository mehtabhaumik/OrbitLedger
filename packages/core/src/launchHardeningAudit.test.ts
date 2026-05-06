import { describe, expect, it } from 'vitest';

import {
  buildOrbitLedgerPublicLaunchAudit,
  getLaunchHardeningOpenBlockers,
} from './launchHardeningAudit';

describe('public launch hardening audit', () => {
  it('keeps the launch audit broad and strict', () => {
    const audit = buildOrbitLedgerPublicLaunchAudit({}, '2026-05-05T00:00:00.000Z');

    expect(new Set(audit.checks.map((check) => check.area))).toEqual(
      new Set([
        'environment',
        'ci',
        'security',
        'firebase',
        'web',
        'mobile',
        'payments',
        'data_privacy',
        'ui_ux',
        'operations',
      ])
    );
    expect(audit.checkCount).toBeGreaterThanOrEqual(20);
    expect(getLaunchHardeningOpenBlockers(audit).length).toBeGreaterThan(0);
    expect(audit.readyForPublicLaunch).toBe(false);
  });

  it('flags the active Node version as launch-blocking when it is too old', () => {
    const audit = buildOrbitLedgerPublicLaunchAudit({ activeNodeMajor: 18 }, '2026-05-05T00:00:00.000Z');
    const nodeCheck = audit.checks.find((check) => check.id === 'node-24-active');

    expect(nodeCheck).toMatchObject({
      status: 'fail',
      launchBlocking: true,
    });
  });

  it('keeps known parity gaps blocking even when manual checks are supplied', () => {
    const audit = buildOrbitLedgerPublicLaunchAudit(
      {
        activeNodeMajor: 24,
        appCheckProductionConfigured: true,
        browserQaPassed: true,
        expoDoctorPassed: true,
        firebaseHostingDeployed: true,
        firebaseRuleTestsPassed: true,
        firebaseStorageInitialized: true,
        firestorePitREnabled: true,
        mobileDeviceQaPassed: true,
        npmAuditPassed: true,
        storageRuleTestsPassed: true,
        typecheckPassed: true,
        unitTestsPassed: true,
        webBuildPassed: true,
      },
      '2026-05-05T00:00:00.000Z'
    );
    const parityCheck = audit.checks.find((check) => check.id === 'feature-parity-no-critical-gaps');

    expect(parityCheck?.status).toBe('warn');
    expect(parityCheck?.launchBlocking).toBe(true);
    expect(audit.launchBlockingOpenCount).toBe(1);
    expect(audit.readyForPublicLaunchMinusPayments).toBe(false);
    expect(audit.readyForPublicLaunch).toBe(false);
  });

  it('keeps Razorpay live checkout separate from the non-payment launch gate', () => {
    const audit = buildOrbitLedgerPublicLaunchAudit(
      {
        activeNodeMajor: 24,
        controlledPaymentTestPassed: false,
        razorpayConnected: false,
      },
      '2026-05-05T00:00:00.000Z'
    );
    const razorpayCheck = audit.checks.find((check) => check.id === 'razorpay-live-not-enabled');

    expect(razorpayCheck?.launchBlocking).toBe(false);
    expect(razorpayCheck?.status).toBe('manual');
  });
});
