# Provider Connection Readiness Gate

Orbit Ledger now has an explicit readiness gate for online payment providers.

Manual payment collection can be launch-ready without pretending Razorpay or any other checkout provider is connected. Online checkout remains hidden unless provider mode is explicitly connected and the basic public URLs are safe.

## What This Phase Adds

- Shared provider readiness helper in `@orbit-ledger/core`.
- Payments page gate showing whether checkout is allowed or blocked.
- Manual mode is treated as launch-ready for manual collection.
- Test-ready mode is blocked from public checkout claims.
- Connected mode requires safe HTTPS payment page and webhook URLs.

## Current Launch State

Orbit Ledger is ready for manual collection.

Online provider checkout is intentionally blocked because no real provider account and credentials are connected.

## Rule

Do not show online checkout to customers unless:

- provider mode is connected,
- payment page URL is HTTPS,
- provider webhook URL is HTTPS,
- real provider verification has passed.

Until then:

- show manual instructions,
- show UPI/bank details,
- record and verify manual payments,
- keep provider setup admin-only.
