# Orbit Ledger Purchase Launch Runbook + Provider Go-Live Checklist

Last updated: 2026-05-04

This runbook defines how Orbit Ledger should move from manual/provider-pending purchase mode to real paid checkout. It is written for engineering, product, operations, finance, and AI agents working on the launch.

The current launch position is intentional:

- The app can show Free, Plus, Pro Plus, and Office plans.
- Country pricing exists for INR, USD, CAD, AUD, and GBP.
- Checkout can stay in provider-pending mode without pretending payment was collected.
- Entitlement, receipt, billing email, purchase review, retry, recovery, and audit flows exist.
- Real provider credentials and live price IDs must be connected before live checkout is opened.

Do not open real checkout until every required go-live check is complete.

## Launch Rule

Orbit Ledger must never:

- activate paid access without trusted provider confirmation,
- show a live checkout URL when provider setup is incomplete,
- accept unsigned or unverified payment webhooks,
- lose a confirmed purchase because local browser state is stale,
- collect payment without receipt recovery,
- hide failed billing email or purchase events from review,
- or leave the team without a rollback path.

## Plans And Countries

Launch plans:

- Free
- Plus
- Pro Plus
- Office

Launch currencies:

- INR for India
- USD for United States
- CAD for Canada
- AUD for Australia
- GBP for United Kingdom

Launch provider direction:

- India: Razorpay
- United States, Canada, Australia, United Kingdom: Razorpay international payment support
- Apple and Google: documented later for native in-app purchase parity
- Stripe: not part of the current launch plan

## Required Preflight

1. Freeze plan scope.

   Confirm plan names, monthly/yearly prices, included features, refund language, support owner, and launch countries. Do not change pricing or plan rules while live provider setup is underway.

2. Run purchase QA.

   Required local checks:

   ```bash
   npm exec vitest run apps/functions/src/providerPayload.test.ts packages/core/src/monetization.test.ts apps/web/src/lib/subscription-billing-documents.test.ts apps/web/src/lib/web-monetization.test.ts apps/mobile/src/monetization/subscription.test.ts
   npm run typecheck --workspace @orbit-ledger/core
   npm run typecheck --workspace @orbit-ledger/web
   npm run typecheck --workspace @orbit-ledger/mobile
   npm run typecheck --workspace @orbit-ledger/functions
   npm run build --workspace @orbit-ledger/functions
   npm run build --workspace @orbit-ledger/web
   ```

3. Confirm provider-pending behavior.

   Until live credentials are connected, checkout must show calm user-facing guidance. It must not expose provider jargon or unlock paid access.

4. Confirm recovery surfaces.

   The Market purchase review area must show checkout events, billing documents, entitlement audit items, receipt recovery, receipt email status, and manual resend controls.

## Provider Go-Live Checklist

### Provider Account

- Business account is verified with the provider.
- KYC or business verification is complete.
- Settlement bank account is connected.
- Provider support contact and dispute email are set.
- Live mode is available.

Evidence:

- Provider dashboard shows verified live account status.

Failure mode:

- Payment may be collected but settlement or live checkout may fail.

### Country, Currency, And Plan Mapping

- Plus, Pro Plus, and Office plans are approved for monthly and yearly billing.
- Prices are approved in INR, USD, CAD, AUD, and GBP.
- Each launch country maps to the correct checkout provider.
- Every paid plan has a provider price ID.

Evidence:

- `getOrbitLedgerProviderPrice(...)` returns the expected provider, currency, amount, and price ID for every paid plan and country.

Failure mode:

- Users see the wrong price, wrong currency, or unavailable checkout.

### Secrets

Razorpay:

- Live key ID is deployed.
- Live key secret is deployed.
- Webhook secret is deployed.
- Payment link or checkout creation is enabled.

Evidence:

- Production functions can create a provider checkout in live mode and webhooks reject bad signatures.

Failure mode:

- Checkout cannot start, or fake webhook events could unlock access.

### Webhooks

- Webhook endpoints are production HTTPS URLs.
- Signature verification is mandatory.
- Raw body validation is preserved.
- Subscription purchase confirmation maps to checkout intent ID.
- Refund and failed payment events are recorded without corrupting entitlement.

Evidence:

- Bad signature fails.
- Valid test event creates the correct checkout event.

Failure mode:

- Paid access may unlock incorrectly, or real purchases may not unlock.

### Checkout Experience

- Production callback URL is approved.
- Localhost callback URLs are rejected.
- Orbit Ledger branding is visible on checkout and login surfaces where provider allows.
- Failed checkout gives retry path.
- Pending checkout blocks duplicate purchase attempts.

Evidence:

- Web checkout returns a valid provider URL only when provider is live.

Failure mode:

- User confusion, duplicate purchases, or unsafe redirects.

### Entitlement Sync

- Confirmed payment creates server entitlement.
- Entitlement audit record is created.
- Browser purchase cache does not override server truth.
- Purchase recovery restores paid state after refresh/logout/login.
- Downgrades and billing-cycle changes are queued for renewal instead of applied immediately.

Evidence:

- A controlled payment unlocks the correct plan and logs entitlement audit.

Failure mode:

- Customer pays but remains locked, or plan changes apply at the wrong time.

### Billing Documents

- Receipt metadata is generated.
- Tax document metadata is generated where relevant.
- Country tax label is correct.
- Buyer business details are shown when available.
- Receipt can be viewed and downloaded.
- Receipt recovery rebuilds missing metadata.

Evidence:

- Confirmed purchase has receipt number, tax label, amount, currency, plan, and buyer details.

Failure mode:

- Paid users cannot retrieve proof of purchase.

### Billing Email

- Billing email queue creates request records.
- Provider delivery sync can mark sent, failed, or pending provider connection.
- Manual resend is available.
- Admin queue records remain visible for failed or provider-pending messages.

Evidence:

- Receipt email request shows delivery status and resend count.

Failure mode:

- Users do not receive receipts and support cannot track what happened.

### Country Tax Review

- India GST treatment is reviewed.
- UK VAT treatment is reviewed.
- Canada GST/HST treatment is reviewed.
- Australia GST treatment is reviewed.
- US state sales tax treatment is reviewed.
- Missing business tax IDs are clearly flagged.

Evidence:

- Finance/accounting owner signs off launch-country tax document language.

Failure mode:

- Receipts may be legally incomplete or misleading.

### Admin Recovery

- Admin can review failed checkouts.
- Admin can review pending billing email delivery.
- Admin can process renewal-change requests.
- Admin can recover billing documents.
- Support has clear copy for failed or pending purchases.

Evidence:

- Purchase review and admin queue show actionable state for every failure.

Failure mode:

- Support cannot resolve payment issues quickly.

### Controlled Live Payment

Before public launch, run a small-value live payment for each live provider path.

For each provider:

1. Start checkout from the Market page.
2. Complete payment with a real small amount.
3. Confirm webhook is received.
4. Confirm entitlement is active.
5. Confirm purchase audit is created.
6. Confirm receipt can be viewed and downloaded.
7. Confirm billing email state is queued, sent, failed, or pending provider connection.
8. Confirm refund or reversal path is understood.

Evidence:

- Screenshots or logs for checkout, webhook, entitlement, receipt, and admin review.

Failure mode:

- Untested live checkout may fail for real customers.

## Launch Runbook

### Phase 1: Preflight

Action:

- Freeze plan and country scope.
- Run purchase QA matrix.
- Confirm no launch-blocking checks remain.

Success:

- Tests pass.
- Provider-pending behavior is safe.
- Recovery surfaces exist.

Rollback:

- Keep checkout in manual/provider-pending mode.

### Phase 2: Provider Setup

Action:

- Complete KYC.
- Add live keys.
- Add live price IDs.
- Add webhook secrets.
- Add production callback domains.

Success:

- Provider dashboard is live-ready.
- Production functions reject bad signatures.
- Provider checkout can be created in a controlled test.

Rollback:

- Remove live keys or set price status back to provider-pending.

### Phase 3: Controlled Test

Action:

- Run one small live payment per provider path.
- Validate entitlement, receipt, billing email status, audit trail, and recovery.

Success:

- Paid access unlocks correctly.
- Billing records are accurate.
- Support can see the purchase trail.

Rollback:

- Refund test payment.
- Disable live checkout.
- Fix and repeat controlled test.

### Phase 4: Launch

Action:

- Open checkout to users.
- Monitor purchase events, failed checkouts, entitlements, receipts, email delivery, and admin queues.

Success:

- Users can purchase without manual intervention.
- Failures show retry/recovery messaging.

Rollback:

- Switch checkout back to provider-pending/manual mode.
- Preserve existing entitlements.

### Phase 5: First 72 Hours

Action:

- Review purchase logs twice daily.
- Review failed checkout and billing email queues.
- Review support messages.
- Check refund and cancellation cases.

Success:

- No unresolved repeated failure.
- No paid customer remains locked.
- No receipt recovery remains incomplete.

Rollback:

- Pause checkout and keep entitlement support active.

### Phase 6: Emergency Rollback

Action:

- Disable live checkout creation.
- Keep existing entitlements active.
- Stop broken receipt email delivery.
- Log affected checkout attempts.
- Notify support with user-safe explanation.

Success:

- No new broken payment attempts are created.
- Existing paid users keep access.

Restart rule:

- Do not reopen checkout until controlled live payment passes again.

## User-Facing Language Rules

Do not show:

- Resend
- Webhook
- Provider secret
- KYC
- Manual provider pending
- Raw gateway error

Use:

- Payment checkout is being prepared.
- Purchase could not be completed. Please try again.
- Purchase restored.
- Receipt is ready.
- Receipt email is queued.
- We are reviewing this billing request.

## Final Go-Live Decision

Real checkout can be opened only when:

- all required provider go-live checks are complete,
- country tax review has a named owner,
- live provider credentials are deployed,
- webhook signature tests pass,
- one small live payment per provider path succeeds,
- rollback switch is ready,
- purchase QA matrix remains green,
- support knows how to recover failed purchases.
