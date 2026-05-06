import { describe, expect, it } from 'vitest';

import {
  ORBIT_LEDGER_DIFFERENTIATION_QA_CHECKS,
  getDifferentiationQaReadiness,
  getLaunchBlockingDifferentiationQaChecks,
} from './differentiationQa';

describe('differentiation QA launch readiness', () => {
  it('covers every market differentiation area', () => {
    expect(ORBIT_LEDGER_DIFFERENTIATION_QA_CHECKS.map((check) => check.area)).toEqual(
      expect.arrayContaining([
        'daily_action_center',
        'collection_coach',
        'customer_trust_memory',
        'owner_closing_ritual',
        'mistake_recovery',
        'smart_document_pack',
        'local_business_intelligence',
        'business_health_score',
        'voice_whatsapp_fast_entry',
        'founder_safe_support',
        'mobile_web_parity',
        'launch_polish',
      ])
    );
  });

  it('keeps launch-blocking differentiation checks explicit', () => {
    const launchBlocking = getLaunchBlockingDifferentiationQaChecks();

    expect(launchBlocking.length).toBeGreaterThanOrEqual(10);
    for (const check of launchBlocking) {
      expect(check.label.trim().length).toBeGreaterThan(8);
      expect(check.expected.trim().length).toBeGreaterThan(30);
      expect(check.evidence.trim().length).toBeGreaterThan(20);
    }
  });

  it('reports readiness for launch polish', () => {
    expect(getDifferentiationQaReadiness()).toMatchObject({
      checkCount: ORBIT_LEDGER_DIFFERENTIATION_QA_CHECKS.length,
      missingEvidenceCount: 0,
      readyForLaunchPolish: true,
    });
  });

  it('does not let technical support or fast entry rules become optional', () => {
    const ids = getLaunchBlockingDifferentiationQaChecks().map((check) => check.id);

    expect(ids).toContain('fast-entry-review-first');
    expect(ids).toContain('support-privacy-review');
    expect(ids).toContain('mobile-web-same-meaning');
  });
});
