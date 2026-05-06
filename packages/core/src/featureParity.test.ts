import { describe, expect, it } from 'vitest';

import {
  ORBIT_LEDGER_FEATURE_REGISTRY,
  ORBIT_LEDGER_PARITY_PHASES,
  getFeatureParityGaps,
  getFeatureParityGapsForPhase,
  getFeatureParitySummary,
} from './featureParity';

describe('Orbit Ledger feature parity registry', () => {
  it('keeps feature ids unique and meaningful', () => {
    const ids = ORBIT_LEDGER_FEATURE_REGISTRY.map((feature) => feature.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('products-inventory');
    expect(ids).toContain('provider-event-admin');
    expect(ids).toContain('document-template-catalog');
  });

  it('records explicit mobile and web coverage for every feature', () => {
    for (const feature of ORBIT_LEDGER_FEATURE_REGISTRY) {
      expect(feature.label.trim().length).toBeGreaterThan(3);
      expect(feature.userPromise.trim().length).toBeGreaterThan(10);
      expect(feature.parityRule.trim().length).toBeGreaterThan(10);
      expect(feature.mobile.evidence.trim().length).toBeGreaterThan(10);
      expect(feature.web.evidence.trim().length).toBeGreaterThan(10);
    }
  });

  it('requires every partial or missing gap to point to a planned parity phase', () => {
    const phaseIds = new Set(ORBIT_LEDGER_PARITY_PHASES.map((phase) => phase.id));
    const gaps = getFeatureParityGaps();

    expect(gaps.length).toBeGreaterThan(0);
    for (const gap of gaps) {
      expect(gap.gap.trim().length).toBeGreaterThan(10);
      expect(phaseIds.has(gap.nextPhase)).toBe(true);
      expect(gap.nextPhase).not.toBe('phase_1_registry');
    }
  });

  it('captures the known launch-critical web parity gaps without hiding them', () => {
    const webGapIds = getFeatureParityGaps()
      .filter((gap) => gap.platform === 'web')
      .map((gap) => gap.featureId);

    expect(webGapIds).toEqual(
      expect.arrayContaining([
        'monetization-free-pro',
      ])
    );
  });

  it('captures the known mobile parity gaps around provider administration and shared documents', () => {
    const mobileGapIds = getFeatureParityGaps()
      .filter((gap) => gap.platform === 'mobile')
      .map((gap) => gap.featureId);

    expect(mobileGapIds).toEqual(
      expect.arrayContaining([
        'customers-profile-fields',
        'invoice-pdf-csv-generation',
      ])
    );
  });

  it('keeps remaining phases mapped to concrete gaps', () => {
    const completedPhases = new Set([
      'phase_1_registry',
      'phase_2_web_products_inventory',
      'phase_3_web_customer_timeline_followup',
      'phase_4_web_business_reviews',
      'phase_5_mobile_provider_admin',
    ]);
    for (const phase of ORBIT_LEDGER_PARITY_PHASES.filter((entry) => !completedPhases.has(entry.id))) {
      expect(getFeatureParityGapsForPhase(phase.id).length).toBeGreaterThan(0);
    }
  });

  it('summarizes parity without pretending the product is already equal on both platforms', () => {
    const summary = getFeatureParitySummary();

    expect(summary.featureCount).toBe(ORBIT_LEDGER_FEATURE_REGISTRY.length);
    expect(summary.completeOnBothPlatforms).toBeGreaterThan(5);
    expect(summary.launchCriticalGapCount).toBeGreaterThan(0);
    expect(summary.webGapCount + summary.mobileGapCount).toBeGreaterThan(0);
  });
});
