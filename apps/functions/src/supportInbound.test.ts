import { describe, expect, it } from 'vitest';

import {
  buildSupportInboundMessageBody,
  buildSupportReplyToAddress,
  extractMailboxAddress,
  extractSupportInboundMessageReferences,
  inferSupportKindFromInboundEmail,
  parseSupportInboundRoute,
} from './supportInbound';

describe('support inbound helpers', () => {
  it('extracts mailbox addresses and builds case-specific reply aliases', () => {
    expect(extractMailboxAddress('Orbit Ledger <support@orbitledger.rudraix.com>')).toBe('support@orbitledger.rudraix.com');
    expect(buildSupportReplyToAddress('support@orbitledger.rudraix.com', 'OL-SUP-20260522-ABC123')).toBe(
      'support+ol-sup-20260522-abc123@orbitledger.rudraix.com'
    );
  });

  it('parses inbound routing from reply aliases or the base inbox', () => {
    expect(
      parseSupportInboundRoute(
        ['support+ol-sup-20260522-abc123@orbitledger.rudraix.com'],
        'support@orbitledger.rudraix.com'
      )
    ).toMatchObject({
      supportCaseId: 'OL-SUP-20260522-ABC123',
      usedBaseInbox: false,
    });

    expect(
      parseSupportInboundRoute(['support@orbitledger.rudraix.com'], 'support@orbitledger.rudraix.com')
    ).toMatchObject({
      supportCaseId: null,
      usedBaseInbox: true,
    });
  });

  it('extracts threading references from inbound headers', () => {
    expect(
      extractSupportInboundMessageReferences({
        'In-Reply-To': '<first@example.com>',
        References: '<older@example.com> <first@example.com>',
      })
    ).toEqual(['<first@example.com>', '<older@example.com>']);
  });

  it('builds a usable inbound message body and infers deterministic support kinds', () => {
    expect(
      buildSupportInboundMessageBody({
        text: '',
        html: '<p>My invoice PDF is broken</p><div>Please fix it.</div>',
      })
    ).toContain('My invoice PDF is broken');

    expect(inferSupportKindFromInboundEmail('Refund charged twice', 'Payment problem')).toBe('purchase_help');
    expect(inferSupportKindFromInboundEmail('Need restore help', 'Please recover backup')).toBe('restore_help');
    expect(inferSupportKindFromInboundEmail('Feature suggestion', 'Would love a shortcut')).toBe('feature_request');
  });
});
