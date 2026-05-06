import { describe, expect, it } from 'vitest';

import {
  BUSINESS_HEALTH_SCORE_ACTION_FLOWS,
  BUSINESS_HEALTH_SCORE_GUARDRAILS,
  BUSINESS_HEALTH_SCORE_SURFACES,
  buildBusinessHealthScore,
  getBusinessHealthScoreActionFlow,
} from './businessHealthScore';

describe('business health score blueprint', () => {
  it('returns a steady score when no business signal needs review', () => {
    const health = buildBusinessHealthScore({
      businessName: 'Rudraix PVT',
      signal: {
        customerCount: 12,
        backupStatus: 'healthy',
        collectionRatePercent: 72,
      },
    });

    expect(health.title).toBe('Rudraix PVT health score');
    expect(health.score).toBe(100);
    expect(health.grade).toBe('excellent');
    expect(health.factors).toEqual([]);
    expect(health.positiveSignals).toContain('Backup protection looks healthy.');
  });

  it('prioritizes collections when receivables and risky customers need attention', () => {
    const health = buildBusinessHealthScore({
      signal: {
        customerCount: 20,
        receivableChangeAmount: 12000,
        riskyCustomerCount: 2,
        overdueCustomerCount: 1,
        collectionRatePercent: 28,
        unpaidInvoiceCount: 4,
        backupStatus: 'healthy',
      },
    });

    expect(health.score).toBeLessThan(70);
    expect(health.topFactor).toMatchObject({
      area: 'collections',
      priority: 'critical',
      actionTarget: 'open_collection_coach',
    });
    expect(health.factors.map((factor) => factor.area)).toContain('invoices');
  });

  it('tracks operational readiness beyond money collection', () => {
    const health = buildBusinessHealthScore({
      signal: {
        pendingPaymentCount: 2,
        pendingClearanceCount: 1,
        outOfStockCount: 2,
        backupStatus: 'failed',
        documentReadinessIssues: 2,
        localSetupIssues: 2,
        dailyClosingOpenItems: 3,
      },
    });

    expect(health.tone).toBe('critical');
    expect(health.factors.map((factor) => factor.area)).toEqual([
      'backup',
      'payments',
      'inventory',
      'local_setup',
      'daily_rhythm',
      'documents',
    ]);
  });

  it('defines every launch score surface and guardrail', () => {
    expect(BUSINESS_HEALTH_SCORE_SURFACES.map((surface) => surface.area)).toEqual([
      'collections',
      'invoices',
      'payments',
      'inventory',
      'backup',
      'documents',
      'local_setup',
      'daily_rhythm',
    ]);
    expect(BUSINESS_HEALTH_SCORE_SURFACES.every((surface) => surface.requiredData.length > 0)).toBe(true);
    expect(BUSINESS_HEALTH_SCORE_GUARDRAILS).toContain(
      'Mobile and web may show different layouts, but the score meaning and factors must match.'
    );
  });

  it('maps every score action target to a web and mobile action flow', () => {
    const surfaceTargets = BUSINESS_HEALTH_SCORE_SURFACES.map((surface) => surface.actionTarget).sort();
    const flowTargets = BUSINESS_HEALTH_SCORE_ACTION_FLOWS.map((flow) => flow.target).sort();

    expect(flowTargets).toEqual(surfaceTargets);
    for (const target of surfaceTargets) {
      const flow = getBusinessHealthScoreActionFlow(target);
      expect(flow.primaryActionLabel.length).toBeGreaterThan(4);
      expect(flow.webRoute).toMatch(/^\//);
      expect(flow.mobileScreen.length).toBeGreaterThan(3);
      expect(flow.completionSignal.length).toBeGreaterThan(10);
    }
  });
});
