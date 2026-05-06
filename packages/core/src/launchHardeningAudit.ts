import { getDifferentiationQaReadiness } from './differentiationQa';
import { getFeatureParitySummary } from './featureParity';
import {
  getOrbitLedgerControlledPaymentTestReadiness,
  getOrbitLedgerMonetizationFreezeReadiness,
  getOrbitLedgerPriceMappingValidation,
  getOrbitLedgerPurchaseQaReadiness,
  ORBIT_LEDGER_CONTROLLED_PAYMENT_TEST_STEPS,
} from './monetization';
import { getSettingsQaReadiness } from './settingsQa';

export type LaunchHardeningArea =
  | 'environment'
  | 'ci'
  | 'security'
  | 'firebase'
  | 'web'
  | 'mobile'
  | 'payments'
  | 'data_privacy'
  | 'ui_ux'
  | 'operations';

export type LaunchHardeningStatus = 'pass' | 'warn' | 'fail' | 'manual';

export type LaunchHardeningAuditCheck = {
  id: string;
  area: LaunchHardeningArea;
  label: string;
  expected: string;
  status: LaunchHardeningStatus;
  launchBlocking: boolean;
  evidence: string;
  nextAction?: string;
};

export type LaunchHardeningAuditInput = {
  activeNodeMajor?: number | null;
  typecheckPassed?: boolean | null;
  unitTestsPassed?: boolean | null;
  firebaseRuleTestsPassed?: boolean | null;
  npmAuditPassed?: boolean | null;
  webBuildPassed?: boolean | null;
  expoDoctorPassed?: boolean | null;
  browserQaPassed?: boolean | null;
  mobileDeviceQaPassed?: boolean | null;
  storageRuleTestsPassed?: boolean | null;
  firebaseHostingDeployed?: boolean | null;
  firestorePitREnabled?: boolean | null;
  firebaseStorageInitialized?: boolean | null;
  appCheckProductionConfigured?: boolean | null;
  razorpayConnected?: boolean | null;
  controlledPaymentTestPassed?: boolean | null;
};

export type LaunchHardeningAuditResult = {
  generatedAt: string;
  checkCount: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  manualCount: number;
  launchBlockingOpenCount: number;
  readyForPublicLaunch: boolean;
  readyForPublicLaunchMinusPayments: boolean;
  checks: LaunchHardeningAuditCheck[];
};

export function buildOrbitLedgerPublicLaunchAudit(
  input: LaunchHardeningAuditInput = {},
  generatedAt = new Date().toISOString()
): LaunchHardeningAuditResult {
  const featureParity = getFeatureParitySummary();
  const settingsQa = getSettingsQaReadiness();
  const differentiationQa = getDifferentiationQaReadiness();
  const purchaseQa = getOrbitLedgerPurchaseQaReadiness();
  const priceMapping = getOrbitLedgerPriceMappingValidation({
    requireActiveProviderPrices: Boolean(input.razorpayConnected),
  });
  const controlledPayment = getOrbitLedgerControlledPaymentTestReadiness(
    input.controlledPaymentTestPassed ? getRequiredControlledPaymentStepIds() : []
  );
  const monetizationFreeze = getOrbitLedgerMonetizationFreezeReadiness({
    providerMode: input.razorpayConnected ? 'live_enabled' : 'provider_pending',
    livePriceMapping: priceMapping,
    controlledPayment,
  });

  const checks: LaunchHardeningAuditCheck[] = [
    check({
      id: 'node-24-active',
      area: 'environment',
      label: 'Node 24 is active for local and CI work',
      expected: 'Node 24.14.0 or newer must be active before running build, deploy, or release commands.',
      status: input.activeNodeMajor && input.activeNodeMajor >= 24 ? 'pass' : 'fail',
      launchBlocking: true,
      evidence: input.activeNodeMajor ? `Detected Node major ${input.activeNodeMajor}.` : 'Active Node version was not provided.',
      nextAction: 'Run `nvm use` or prepend the Node 24 binary path before launch commands.',
    }),
    check({
      id: 'ci-full-gate',
      area: 'ci',
      label: 'CI covers install, typecheck, tests, rules, audit, web build, and Expo doctor',
      expected: 'Every PR and main push must pass the complete quality gate.',
      status: 'pass',
      launchBlocking: true,
      evidence: 'GitHub Actions workflow runs npm ci, typecheck, tests, Firebase rules tests, npm audit, web build, and Expo doctor.',
    }),
    check({
      id: 'typecheck-green',
      area: 'ci',
      label: 'Typecheck is green',
      expected: 'All workspaces must typecheck before public release.',
      status: boolStatus(input.typecheckPassed),
      launchBlocking: true,
      evidence: resultEvidence(input.typecheckPassed, 'Typecheck result supplied by local audit run.'),
    }),
    check({
      id: 'unit-tests-green',
      area: 'ci',
      label: 'Unit and package tests are green',
      expected: 'Core behavior, web helpers, mobile logic, functions, and shared contracts must pass tests.',
      status: boolStatus(input.unitTestsPassed),
      launchBlocking: true,
      evidence: resultEvidence(input.unitTestsPassed, 'Test result supplied by local audit run.'),
    }),
    check({
      id: 'npm-audit-high',
      area: 'security',
      label: 'High-severity npm audit gate is green',
      expected: 'No high or critical dependency vulnerability should be accepted before launch.',
      status: boolStatus(input.npmAuditPassed),
      launchBlocking: true,
      evidence: resultEvidence(input.npmAuditPassed, 'npm audit result supplied by local audit run.'),
    }),
    check({
      id: 'firestore-rules-owner-scoped',
      area: 'firebase',
      label: 'Firestore rules are owner-scoped and deny by default',
      expected: 'Workspace data must only be available to the owner, and unknown paths must deny all access.',
      status: input.firebaseRuleTestsPassed === false ? 'fail' : input.firebaseRuleTestsPassed === true ? 'pass' : 'manual',
      launchBlocking: true,
      evidence: input.firebaseRuleTestsPassed === true
        ? 'Firestore rules tests passed locally.'
        : 'Rules file has owner checks and deny-all fallback; emulator result required.',
      nextAction: input.firebaseRuleTestsPassed ? undefined : 'Run Firebase emulator rules tests before launch.',
    }),
    check({
      id: 'storage-rules-tested',
      area: 'firebase',
      label: 'Storage rules have automated tests',
      expected: 'Uploads for logos, signatures, PDFs, backups, imports, and attachments must be owner-scoped and size/type constrained.',
      status: input.storageRuleTestsPassed ? 'pass' : 'warn',
      launchBlocking: true,
      evidence: input.storageRuleTestsPassed ? 'Storage rule tests passed.' : 'Storage rules exist, but no storage emulator test result was supplied.',
      nextAction: 'Add storage emulator tests for owner access, file type, size, and cross-workspace denial.',
    }),
    check({
      id: 'app-check-production',
      area: 'security',
      label: 'Firebase App Check is configured for production',
      expected: 'Production web and mobile clients should use App Check where Firebase supports it.',
      status: input.appCheckProductionConfigured ? 'pass' : 'manual',
      launchBlocking: true,
      evidence: input.appCheckProductionConfigured ? 'Production App Check marked configured.' : 'Environment keys exist; Firebase Console production enforcement must be verified.',
      nextAction: 'Verify Firebase App Check enforcement and debug-token removal before public launch.',
    }),
    check({
      id: 'firestore-production-safety',
      area: 'firebase',
      label: 'Firestore production safety is enabled',
      expected: 'Default Firestore database should use the chosen region, delete protection, and PITR.',
      status: input.firestorePitREnabled ? 'pass' : 'manual',
      launchBlocking: true,
      evidence: input.firestorePitREnabled ? 'Firestore PITR/delete protection marked verified.' : 'Console state must be verified outside repository checks.',
      nextAction: 'Confirm asia-south1, delete protection, and point-in-time recovery in Firebase Console.',
    }),
    check({
      id: 'firebase-storage-ready',
      area: 'firebase',
      label: 'Firebase Storage is initialized',
      expected: 'Storage bucket must exist before document, logo, proof, backup, and import uploads are launch-supported.',
      status: input.firebaseStorageInitialized ? 'pass' : 'manual',
      launchBlocking: true,
      evidence: input.firebaseStorageInitialized ? 'Storage marked initialized.' : 'Storage rules exist; bucket state must be verified outside repo.',
      nextAction: 'Confirm Firebase Storage bucket exists and rules are deployed.',
    }),
    check({
      id: 'web-build-green',
      area: 'web',
      label: 'Web production build is green',
      expected: 'Next export must build successfully before deploying Hosting.',
      status: boolStatus(input.webBuildPassed),
      launchBlocking: true,
      evidence: resultEvidence(input.webBuildPassed, 'Web build result supplied by local audit run.'),
    }),
    check({
      id: 'firebase-hosting-deployed',
      area: 'web',
      label: 'Firebase Hosting is deployed to public domain',
      expected: 'Public web app should be deployed with Orbit Ledger branding and not rely on localhost.',
      status: input.firebaseHostingDeployed ? 'pass' : 'manual',
      launchBlocking: true,
      evidence: input.firebaseHostingDeployed ? 'Hosting marked deployed.' : 'Hosting config exists; deploy state must be verified.',
      nextAction: 'Deploy apps/web/out to Firebase Hosting and verify branded domain behavior.',
    }),
    check({
      id: 'expo-doctor-green',
      area: 'mobile',
      label: 'Expo doctor is green',
      expected: 'Expo SDK dependencies and app configuration should pass doctor before release builds.',
      status: boolStatus(input.expoDoctorPassed),
      launchBlocking: true,
      evidence: resultEvidence(input.expoDoctorPassed, 'Expo doctor result supplied by local audit run.'),
    }),
    check({
      id: 'mobile-device-qa',
      area: 'mobile',
      label: 'Mobile device QA is complete',
      expected: 'Android release-path QA and iOS/tablet QA where applicable must pass on real devices or production-like simulators.',
      status: input.mobileDeviceQaPassed ? 'pass' : 'manual',
      launchBlocking: true,
      evidence: input.mobileDeviceQaPassed ? 'Mobile device QA marked complete.' : 'Native runtime QA requires device/simulator execution outside static checks.',
      nextAction: 'Run native runtime QA, invoice PDF, backup/restore, image upload, and payment proof flows on device.',
    }),
    check({
      id: 'browser-responsive-qa',
      area: 'ui_ux',
      label: 'Browser responsive QA is complete',
      expected: 'Desktop, tablet, and mobile browser widths must have no clipping, dead summaries, giant CTAs, or layout jumps.',
      status: input.browserQaPassed ? 'pass' : 'manual',
      launchBlocking: true,
      evidence: input.browserQaPassed ? 'Browser QA marked complete.' : 'Visual QA requires browser screenshots and interaction checks.',
      nextAction: 'Run browser QA across login, dashboard, customers, invoices, payments, settings, support, and market.',
    }),
    check({
      id: 'feature-parity-no-critical-gaps',
      area: 'ui_ux',
      label: 'Mobile/web launch-critical parity has no hidden gaps',
      expected: 'Any feature available on one platform should be tracked and intentionally matched or marked platform-specific.',
      status: featureParity.launchCriticalGapCount === 0 ? 'pass' : 'warn',
      launchBlocking: true,
      evidence: `${featureParity.launchCriticalGapCount} launch-critical parity gaps, ${featureParity.mobileGapCount} mobile gaps, ${featureParity.webGapCount} web gaps.`,
      nextAction: featureParity.launchCriticalGapCount === 0 ? undefined : 'Close or explicitly defer launch-critical parity gaps.',
    }),
    check({
      id: 'settings-qa-ready',
      area: 'data_privacy',
      label: 'Settings QA is ready',
      expected: 'User, company, document, payment, notification, security, and audit-protected settings must persist correctly.',
      status: settingsQa.readyForNextPhase ? 'pass' : 'warn',
      launchBlocking: true,
      evidence: `${settingsQa.unplannedParityGapCount} unplanned settings parity gaps.`,
    }),
    check({
      id: 'differentiation-qa-ready',
      area: 'ui_ux',
      label: 'Differentiation QA is ready',
      expected: 'Daily action, collection coach, trust memory, closing, recovery, document pack, local intelligence, fast entry, and support must remain coherent.',
      status: differentiationQa.readyForLaunchPolish ? 'pass' : 'warn',
      launchBlocking: true,
      evidence: `${differentiationQa.checkCount} differentiation checks, ${differentiationQa.missingEvidenceCount} missing evidence.`,
    }),
    check({
      id: 'launch-ops-ready',
      area: 'operations',
      label: 'Launch operations have support, recovery, and owner review paths',
      expected: 'Public launch should include support intake, recovery messaging, billing review, and founder-safe issue reporting.',
      status: 'pass',
      launchBlocking: true,
      evidence: 'Support, feedback, billing review, purchase recovery, receipt recovery, and founder-safe diagnostic surfaces are tracked in product readiness modules.',
    }),
    check({
      id: 'purchase-ready-minus-provider',
      area: 'payments',
      label: 'Purchase system is safe without Razorpay connected',
      expected: 'Plan gates, entitlements, receipts, recovery, audit, and admin queues should be ready while checkout remains provider-pending.',
      status: purchaseQa.readyForLaunchWithoutProvider ? 'pass' : 'warn',
      launchBlocking: false,
      evidence: `${purchaseQa.covered}/${purchaseQa.total} purchase QA checks covered; ${purchaseQa.providerPending} provider-pending.`,
    }),
    check({
      id: 'razorpay-live-not-enabled',
      area: 'payments',
      label: 'Razorpay live checkout is intentionally gated',
      expected: 'Public paid checkout must stay disabled until Razorpay keys, webhooks, price IDs, controlled payment, and recovery are verified.',
      status: input.razorpayConnected ? 'pass' : 'manual',
      launchBlocking: false,
      evidence: monetizationFreeze.blockers.join(' ') || 'Razorpay checkout is ready.',
      nextAction: input.razorpayConnected ? undefined : 'Keep checkout in provider-pending/manual mode until Razorpay is connected.',
    }),
  ];

  const passCount = checks.filter((item) => item.status === 'pass').length;
  const warnCount = checks.filter((item) => item.status === 'warn').length;
  const failCount = checks.filter((item) => item.status === 'fail').length;
  const manualCount = checks.filter((item) => item.status === 'manual').length;
  const launchBlockingOpenCount = checks.filter(
    (item) => item.launchBlocking && item.status !== 'pass'
  ).length;
  const readyForPublicLaunch = launchBlockingOpenCount === 0 && input.razorpayConnected === true;

  return {
    generatedAt,
    checkCount: checks.length,
    passCount,
    warnCount,
    failCount,
    manualCount,
    launchBlockingOpenCount,
    readyForPublicLaunch,
    readyForPublicLaunchMinusPayments: launchBlockingOpenCount === 0,
    checks,
  };
}

export function getLaunchHardeningOpenBlockers(
  result: LaunchHardeningAuditResult
): LaunchHardeningAuditCheck[] {
  return result.checks.filter((check) => check.launchBlocking && check.status !== 'pass');
}

function boolStatus(value?: boolean | null): LaunchHardeningStatus {
  if (value === true) {
    return 'pass';
  }
  if (value === false) {
    return 'fail';
  }
  return 'manual';
}

function resultEvidence(value: boolean | null | undefined, fallback: string) {
  if (value === true) {
    return `${fallback} Passed.`;
  }
  if (value === false) {
    return `${fallback} Failed.`;
  }
  return `${fallback} Not run or not supplied.`;
}

function getRequiredControlledPaymentStepIds() {
  return ORBIT_LEDGER_CONTROLLED_PAYMENT_TEST_STEPS
    .filter((step) => step.requiredBeforePublicLaunch)
    .map((step) => step.id);
}

function check(input: LaunchHardeningAuditCheck): LaunchHardeningAuditCheck {
  return input;
}
