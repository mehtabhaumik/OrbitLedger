# Live Collections Razorpay Failure Matrix

This matrix is the launch-readiness contract for Razorpay-backed Live Collections. The browser never decides payment success. Invoice payment state changes only after a verified backend event or trusted backend verification, and final invoice status comes from allocation math.

## Non-Negotiable Rules

- Razorpay secrets stay server-side only.
- Manual UPI and bank instructions are separate from Razorpay payment links.
- Duplicate webhooks must not create duplicate transactions or allocations.
- Failed, disputed, stale, missing, or ambiguous events go to review.
- Every automated money update writes audit evidence.
- Realtime UI listens to Orbit Ledger Firestore state, not Razorpay directly.

## Failure Matrix

| Scenario | Backend action | Invoice can change | User-visible state | Audit |
| --- | --- | --- | --- | --- |
| Verified captured payment matches unpaid invoice | Apply payment | Yes | Payment received; invoice becomes paid or partially paid from allocation math | Required |
| Duplicate webhook retry | Ignore duplicate | No | No second notification; duplicate ignored in audit | Required |
| Payment failed or payment link cancelled | Needs review | No | Payment failed; invoice remains unpaid | Required |
| Authorized but not captured | Informational only | No | Payment is not final yet | Required |
| Full refund | Record refund | Yes | Payment refunded; invoice balance recalculated | Required |
| Partial refund | Record refund | Yes | Payment partially refunded; balance recalculated | Required |
| Dispute | Needs review | No | Payment needs review | Required |
| Wrong or suspicious amount | Needs review | No | Payment needs review before allocation | Required |
| Missing or stale invoice metadata | Needs review | No | Payment needs review; user can match manually | Required |
| Cancelled invoice match | Needs review | No | Payment needs review because invoice is cancelled | Required |
| Expired payment link | Needs review | No | Payment needs review before ledger changes | Required |
| Browser callback only | Informational only | No | Payment received, verifying | Not money-impacting |
| Manual UPI or bank transfer | Manual workflow | No provider automation | User records or verifies manually | Manual audit path |

## Manual Razorpay Sandbox QA

Before enabling live payment automation for production users:

1. Create a test invoice with a Razorpay payment link.
2. Complete a successful payment and confirm one transaction, one allocation, one audit entry, one notification, one receipt, and one follow-up update.
3. Replay the same webhook and confirm no second transaction or allocation appears.
4. Send `payment.failed` and confirm invoice paid amount does not change.
5. Send `payment.authorized` and confirm invoice remains unpaid until `payment.captured`.
6. Send refund events and confirm reversal records and invoice balance update.
7. Send captured payment with missing invoice metadata and confirm review state.
8. Send captured payment for a cancelled invoice and confirm review state.
9. Confirm web notification copy does not expose provider ids or secrets.
10. Confirm manual UPI and bank payment instructions do not create Razorpay automation.

## Automated Evidence

- `packages/core/src/liveCollectionsQa.test.ts`
- `packages/core/src/liveCollections.test.ts`
- `apps/functions/src/providerPayload.test.ts`
- `apps/web/src/lib/live-collections-status.test.ts`
- `apps/web/src/lib/live-collections-notifications.test.ts`
- `apps/web/src/lib/live-collections-receipts.test.ts`
