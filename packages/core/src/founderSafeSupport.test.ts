import { describe, expect, it } from 'vitest';

import {
  FOUNDER_SAFE_SUPPORT_GUARDRAILS,
  FOUNDER_SAFE_SUPPORT_SURFACES,
  buildFounderSafeDiagnosticSummary,
  buildFounderSafeSupportConsentRecord,
  buildFounderSafeSupportDraft,
} from './founderSafeSupport';

describe('founder-safe support layer blueprint', () => {
  it('defines the support surfaces needed by web and mobile', () => {
    expect(FOUNDER_SAFE_SUPPORT_SURFACES.map((surface) => surface.area)).toEqual([
      'issue_report',
      'restore_help',
      'feature_request',
      'diagnostic_summary',
      'purchase_support',
      'privacy_review',
    ]);
    expect(FOUNDER_SAFE_SUPPORT_SURFACES.every((surface) => surface.safeData.length > 0)).toBe(true);
    expect(FOUNDER_SAFE_SUPPORT_SURFACES.every((surface) => surface.blockedData.length > 0)).toBe(true);
  });

  it('removes private fields from diagnostic summaries', () => {
    const summary = buildFounderSafeDiagnosticSummary({
      appVersion: '1.0.0',
      businessName: 'Rudraix PVT',
      customerEmail: 'customer@example.com',
      customerName: 'Sonali Traders',
      errorCode: 'PDF_PRINT_FAILED',
      platform: 'web',
      rawUrl: '/customers/customer_123456789abcdef0?email=customer@example.com',
      recordCounts: {
        customers: 2,
        invoices: 5,
      },
      route: '/customers/customer_123456789abcdef0?tab=invoices',
    });

    expect(summary.safeFields).toMatchObject({
      appVersion: '1.0.0',
      platform: 'web',
      route: '/customers/customer_[id]',
      errorCode: 'PDF_PRINT_FAILED',
      customerCount: 2,
      invoiceCount: 5,
    });
    expect(JSON.stringify(summary.safeFields)).not.toContain('Sonali');
    expect(JSON.stringify(summary.safeFields)).not.toContain('customer@example.com');
    expect(summary.redactedFields).toEqual([
      'business name',
      'customer name',
      'customer email',
      'raw URL',
    ]);
  });

  it('flags and redacts private data in user-written support text', () => {
    const draft = buildFounderSafeSupportDraft({
      kind: 'invoice_issue',
      message: 'Invoice WEB-641090 for customer@example.com has wrong GSTIN 24ABCDE1234F1Z5.',
      screen: 'Invoices',
    });

    expect(draft.canSubmit).toBe(false);
    expect(draft.requiresPrivacyReview).toBe(true);
    expect(draft.privateDataWarnings).toEqual([
      'email address',
      'GSTIN',
      'document number',
    ]);
    expect(draft.sanitizedMessage).toContain('[document number removed]');
    expect(draft.sanitizedMessage).toContain('[email removed]');
    expect(draft.sanitizedMessage).toContain('[GSTIN removed]');
  });

  it('allows a clean support request without diagnostics', () => {
    const draft = buildFounderSafeSupportDraft({
      kind: 'feature_request',
      message: 'Please add a weekly collection summary on the dashboard.',
      screen: 'Dashboard',
    });

    expect(draft.canSubmit).toBe(true);
    expect(draft.priority).toBe('low');
    expect(draft.actionTarget).toBe('open_feature_feedback');
    expect(draft.diagnosticSummary).toBeNull();
  });

  it('requires approval before diagnostics are attached', () => {
    const draft = buildFounderSafeSupportDraft({
      diagnostic: {
        appVersion: '1.0.0',
        platform: 'android',
      },
      includeDiagnostics: true,
      kind: 'sync_issue',
      message: 'Sync is not finishing.',
      userApprovedDiagnostics: false,
    });

    expect(draft.canSubmit).toBe(false);
    expect(draft.requiresPrivacyReview).toBe(true);
    expect(draft.diagnosticSummary).toBeNull();
  });

  it('keeps the non-negotiable privacy guardrails visible', () => {
    expect(FOUNDER_SAFE_SUPPORT_GUARDRAILS).toContain(
      'Diagnostics must be opt-in and must show a clear preview before sending.'
    );
    expect(FOUNDER_SAFE_SUPPORT_GUARDRAILS).toContain(
      'Web and mobile may use different layouts, but support categories, privacy rules, and safe diagnostic fields must match.'
    );
  });

  it('builds a consent-bound diagnostic review pack', () => {
    const record = buildFounderSafeSupportConsentRecord({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      supportKind: 'sync_issue',
      supportCaseId: 'CASE-2001',
      message: 'Please review sync. Do not expose customer@example.com.',
      diagnostic: {
        appVersion: 'web',
        platform: 'web',
        route: '/customers/customer_123456789abcdef0',
        customerEmail: 'customer@example.com',
        recordCounts: {
          customers: 2,
          invoices: 3,
        },
      },
      now: new Date('2026-05-07T00:00:00.000Z'),
    });

    expect(record).toMatchObject({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      supportKind: 'sync_issue',
      supportCaseId: 'CASE-2001',
      status: 'active',
    });
    expect(record.sanitizedMessage).toContain('[email removed]');
    expect(record.approvedFields).toContain('route');
    expect(record.redactedFields).toContain('customer email');
    expect(record.expiresAt).toBe('2026-05-14T00:00:00.000Z');
  });
});
