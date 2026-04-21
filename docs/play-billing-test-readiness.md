# Orbit Ledger Android Play Billing Test Readiness

This guide is the source of truth for Android Google Play Billing QA. It does not cover iOS.

## Android App Identity

- Play Console app package name: `com.rudraix.orbitledger`
- Expo plugin required for billing: `expo-iap`
- Billing runtime required: signed Android build installed from a Play testing track
- Expo Go is not valid for billing QA

## Final Android Product Matrix

### Subscriptions

| Entitlement | Play product ID | Product type | Base plan ID | Renewal period | App plan ID |
| --- | --- | --- | --- | --- | --- |
| Orbit Ledger Pro Monthly | `com.rudraix.orbitledger.pro.monthly` | Subscription | `monthly` | 1 month | `pro_monthly` |
| Orbit Ledger Pro Yearly | `com.rudraix.orbitledger.pro.yearly` | Subscription | `yearly` | 1 year | `pro_yearly` |

### One-Time Products

| Entitlement | Play product ID | Product type | App country code |
| --- | --- | --- | --- |
| United States Country Pack | `com.rudraix.orbitledger.countrypack.us` | One-time product | `US` |
| United Kingdom Country Pack | `com.rudraix.orbitledger.countrypack.uk` | One-time product | `GB` |

### Included By Default

| Entitlement | Play product ID | Product type | App country code |
| --- | --- | --- | --- |
| India Starter GST Country Package | None | Included app feature | `IN` |

India is intentionally included by default. Do not create a paid Play product for India in this phase. The app must allow India package installation without purchase.

## Play Console Setup

1. Create or open the Play Console app for package `com.rudraix.orbitledger`.
2. Upload a signed Android App Bundle to an internal testing or closed testing track.
3. Add license tester Gmail accounts under Play Console billing/license testing.
4. Create these subscription products:
   - Product ID: `com.rudraix.orbitledger.pro.monthly`
     - Name: Orbit Ledger Pro Monthly
     - Base plan ID: `monthly`
     - Billing period: Monthly
     - Status: Active
   - Product ID: `com.rudraix.orbitledger.pro.yearly`
     - Name: Orbit Ledger Pro Yearly
     - Base plan ID: `yearly`
     - Billing period: Yearly
     - Status: Active
5. Add an active offer to each subscription base plan if Play Console requires an offer for tester purchase.
6. Create these one-time products:
   - Product ID: `com.rudraix.orbitledger.countrypack.us`
     - Name: United States Country Pack
     - Status: Active
   - Product ID: `com.rudraix.orbitledger.countrypack.uk`
     - Name: United Kingdom Country Pack
     - Status: Active
7. Do not create `com.rudraix.orbitledger.countrypack.in`.
8. Ensure the internal/closed testing release is available to tester accounts before billing QA starts.

## Tester And Device Setup

1. Use an Android device or emulator with Google Play Store installed.
2. Sign into Play Store with a Gmail account listed as a license tester and added to the app testing track.
3. Install Orbit Ledger from the Play testing link, not by sideloading an APK.
4. Confirm the installed app package is `com.rudraix.orbitledger`.
5. Install Play Billing Lab from Google Play when testing accelerated renewals, pending purchases, and error responses.
6. In Play Billing Lab, select Orbit Ledger and configure the desired test behavior before opening the purchase flow.
7. Clear old purchase state only through Play Console/order management/test account tools; do not rely on deleting app data alone for entitlement reset.
8. Use a fresh app install for uninstall/reinstall restore testing.

## Billing Test Matrix

| ID | Scenario | Setup | Steps | Expected result |
| --- | --- | --- | --- | --- |
| B-01 | Pro Monthly purchase succeeds | Monthly product active; tester account signed in | Open Upgrade, tap Monthly Pro, complete Play purchase | App shows Pro active; `pro_monthly` gated features unlock; purchase survives app restart |
| B-02 | Pro Yearly purchase succeeds | Yearly product active; tester account signed in | Open Upgrade, tap Yearly Pro, complete Play purchase | App shows Pro active; `pro_yearly` is current plan; Pro document features unlock |
| B-03 | US country pack purchase succeeds | US product active; tester account signed in | Open Country Packages, buy United States package, complete Play purchase | US package becomes Purchased; user can install/activate US package |
| B-04 | UK country pack purchase succeeds | UK product active; tester account signed in | Open Country Packages, buy United Kingdom package, complete Play purchase | UK package becomes Purchased; user can install/activate UK package |
| B-05 | India is included without purchase | No India Play product exists | Open Country Packages, choose India package | India package shows Included; no Play purchase opens; install/activate works |
| B-06 | Cancelled purchase | Tester account signed in | Start Monthly Pro purchase, cancel in Play purchase sheet | App shows cancellation message; Pro remains inactive |
| B-07 | Pending purchase | Play Billing Lab pending behavior enabled if available | Start a supported purchase and leave it pending | App shows pending message; entitlement does not unlock until Play confirms purchase |
| B-08 | Failed purchase | Play Billing Lab failure response enabled if available | Start any paid purchase | App shows failure message; existing entitlement state is preserved |
| B-09 | Restore purchases | Complete B-01 or B-02 first | Open Upgrade, tap Restore Purchases | App refreshes Pro entitlement from Play state |
| B-10 | Country pack restore | Complete B-03 or B-04 first | Open Country Packages, tap Restore Purchases | Purchased country pack reappears as Purchased |
| B-11 | App restart entitlement refresh | Complete a Pro purchase | Force close app, reopen | Pro status remains active after startup refresh |
| B-12 | App resume entitlement refresh | Complete or revoke a test purchase externally | Background app, adjust state, foreground app | Entitlement refresh runs on resume and UI reflects current cached state after reload |
| B-13 | Uninstall/reinstall restore | Complete a Pro and a country-pack purchase | Uninstall app, reinstall from Play test track, tap Restore Purchases | Pro and purchased country packs are restored from Play |
| B-14 | Wrong country pack isolation | Purchase US only | Open Country Packages | US is Purchased; UK remains Locked; buying/installing UK still requires UK product |
| B-15 | Unknown/removed product safety | Remove/deactivate a test product temporarily | Open purchase screen and try that product | App shows product/store availability error and does not unlock access |

## Repo-Side Verification Commands

Run these before handing a build to testers:

```sh
npx tsc --noEmit
npm ls expo-iap
npx expo config --type public
```

Expected repo-side checks:

- `expo-iap` is installed.
- Expo config includes `expo-iap`.
- Android package is `com.rudraix.orbitledger`.
- `COUNTRY_PACK_STORE_PRODUCT_IDS` contains only US and UK paid country packs.
- India is included through `isIncludedCountryPackage('IN')`, not Play Billing.

## Known Non-Repo Dependencies

- Product activation in Play Console.
- Signed internal/closed testing build distribution.
- License tester account setup.
- Real Play purchase sheet execution.
- Play Billing Lab availability on tester devices.
- Any future server-side receipt validation. This phase intentionally does not implement backend receipt validation.
