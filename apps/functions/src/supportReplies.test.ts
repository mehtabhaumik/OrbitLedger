import { describe, expect, it } from 'vitest';

import { buildSupportReplyTransition } from './index';

describe('support reply transitions', () => {
  it('moves a normal reply into waiting on customer', () => {
    expect(buildSupportReplyTransition({ action: 'reply' })).toMatchObject({
      supportCaseAction: 'wait_for_customer',
      nextCaseStatus: 'waiting_on_customer',
      nextTicketStatus: 'pending_customer',
      nextResolutionState: 'unresolved',
      customerEmailRequired: true,
    });
  });

  it('requires an outcome reason when closing from the reply composer', () => {
    expect(buildSupportReplyTransition({ action: 'close_with_reply', previousResolutionReason: 'answered' })).toMatchObject({
      supportCaseAction: 'close',
      nextCaseStatus: 'closed',
      nextTicketStatus: 'closed',
      nextResolutionState: 'resolved',
      nextResolutionReason: 'answered',
      resolutionReasonRequired: true,
    });

    expect(buildSupportReplyTransition({ action: 'close_silently', previousResolutionReason: 'fixed' })).toMatchObject({
      supportCaseAction: 'close',
      customerEmailRequired: false,
      resolutionReasonRequired: true,
      customerVisibleMessage: false,
    });
  });

  it('reopens a ticket when the operator sends a fresh reply from a closed thread', () => {
    expect(buildSupportReplyTransition({ action: 'reopen_with_reply' })).toMatchObject({
      supportCaseAction: 'reopen',
      nextCaseStatus: 'reopened',
      nextTicketStatus: 'pending_customer',
      nextResolutionState: 'unresolved',
      customerEmailRequired: true,
    });
  });
});
