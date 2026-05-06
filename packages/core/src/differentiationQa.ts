import { BUSINESS_HEALTH_SCORE_SURFACES } from './businessHealthScore';
import { COLLECTION_COACH_SURFACES } from './collectionCoach';
import { CUSTOMER_TRUST_MEMORY_SURFACES } from './customerTrustMemory';
import { DAILY_ACTION_CENTER_SURFACES } from './dailyActionCenter';
import { FOUNDER_SAFE_SUPPORT_SURFACES } from './founderSafeSupport';
import { LOCAL_BUSINESS_INTELLIGENCE_SURFACES } from './localBusinessIntelligence';
import { MISTAKE_RECOVERY_SURFACES } from './mistakeRecovery';
import { OWNER_CLOSING_RITUAL_SURFACES } from './ownerClosingRitual';
import { SMART_DOCUMENT_PACK_SURFACES } from './smartDocumentPack';
import { VOICE_WHATSAPP_FAST_ENTRY_SURFACES } from './voiceWhatsAppFastEntry';

export type DifferentiationQaArea =
  | 'daily_action_center'
  | 'collection_coach'
  | 'customer_trust_memory'
  | 'owner_closing_ritual'
  | 'mistake_recovery'
  | 'smart_document_pack'
  | 'local_business_intelligence'
  | 'business_health_score'
  | 'voice_whatsapp_fast_entry'
  | 'founder_safe_support'
  | 'mobile_web_parity'
  | 'launch_polish';

export type DifferentiationQaCheck = {
  id: string;
  area: DifferentiationQaArea;
  label: string;
  expected: string;
  launchBlocking: boolean;
  evidence: string;
};

export type DifferentiationQaReadiness = {
  checkCount: number;
  launchBlockingCheckCount: number;
  missingEvidenceCount: number;
  readyForLaunchPolish: boolean;
  launchBlockingChecks: DifferentiationQaCheck[];
};

export const ORBIT_LEDGER_DIFFERENTIATION_QA_CHECKS: DifferentiationQaCheck[] = [
  qaCheck(
    'daily-action-center-actionable',
    'daily_action_center',
    'Daily Action Center gives next actions',
    'Home must tell the owner who to collect from, what to record, what stock needs review, and what documents need attention.',
    true,
    `${DAILY_ACTION_CENTER_SURFACES.length} shared daily action surfaces are defined.`
  ),
  qaCheck(
    'collection-coach-priority-queue',
    'collection_coach',
    'Collection Coach ranks follow-up work',
    'Collection guidance must prioritize missed promises, overdue balances, reminder tone, and next follow-up action.',
    true,
    `${COLLECTION_COACH_SURFACES.length} shared collection coach surfaces are defined.`
  ),
  qaCheck(
    'customer-trust-memory-complete',
    'customer_trust_memory',
    'Customer Trust Memory keeps relationship history',
    'Customer pages must show payments, reminders, promises, notes, disputes, documents, and health context.',
    true,
    `${CUSTOMER_TRUST_MEMORY_SURFACES.length} shared customer trust memory surfaces are defined.`
  ),
  qaCheck(
    'owner-closing-ritual-reviewable',
    'owner_closing_ritual',
    'Owner Closing Ritual supports day-end review',
    'The owner must be able to review collections, new credit, pending payments, stock attention, and tomorrow follow-up.',
    true,
    `${OWNER_CLOSING_RITUAL_SURFACES.length} shared closing ritual surfaces are defined.`
  ),
  qaCheck(
    'mistake-recovery-preserves-history',
    'mistake_recovery',
    'Mistake Recovery preserves history',
    'Payment, invoice, stock, restore, and ledger fixes must guide safe correction instead of silent destructive edits.',
    true,
    `${MISTAKE_RECOVERY_SURFACES.length} shared mistake recovery surfaces are defined.`
  ),
  qaCheck(
    'smart-document-pack-country-aware',
    'smart_document_pack',
    'Smart Document Pack is useful beyond invoices',
    'Documents must cover invoice, statement, payment notice, overdue notice, customer profile, tax summary, and audit packet.',
    true,
    `${SMART_DOCUMENT_PACK_SURFACES.length} shared document pack surfaces are defined.`
  ),
  qaCheck(
    'local-business-intelligence-country-pack',
    'local_business_intelligence',
    'Local Business Intelligence stays country-aware',
    'Country/state packs must guide tax labels, payment wording, local documents, compliance review, and seasonal nudges.',
    true,
    `${LOCAL_BUSINESS_INTELLIGENCE_SURFACES.length} shared local intelligence surfaces are defined.`
  ),
  qaCheck(
    'business-health-score-actionable',
    'business_health_score',
    'Business Health Score explains what to fix',
    'The score must show factors and action flows instead of becoming a vanity number.',
    true,
    `${BUSINESS_HEALTH_SCORE_SURFACES.length} shared business health surfaces are defined.`
  ),
  qaCheck(
    'fast-entry-review-first',
    'voice_whatsapp_fast_entry',
    'Voice and WhatsApp Fast Entry is review-first',
    'Natural-language entries can prepare drafts, but must not silently save money, invoices, customers, stock, or messages.',
    true,
    `${VOICE_WHATSAPP_FAST_ENTRY_SURFACES.length} shared fast entry surfaces are defined.`
  ),
  qaCheck(
    'support-privacy-review',
    'founder_safe_support',
    'Founder-safe support protects private data',
    'Support must show what is shared, redact private-looking fields, and avoid automatic business data attachments.',
    true,
    `${FOUNDER_SAFE_SUPPORT_SURFACES.length} shared support surfaces are defined.`
  ),
  qaCheck(
    'mobile-web-same-meaning',
    'mobile_web_parity',
    'Mobile and web use the same feature meaning',
    'Layouts may differ, but action priority, document rules, support privacy, and review-first behavior must match.',
    true,
    'Differentiation modules live in shared core and are consumed by both apps as they receive UI phases.'
  ),
  qaCheck(
    'plain-language-polish',
    'launch_polish',
    'Differentiation copy stays plain and useful',
    'Screens should use owner-friendly language and avoid generic accounting or technical wording.',
    false,
    'Blueprints and UI copy describe owner actions: collect, review, close, fix, send, protect.'
  ),
  qaCheck(
    'mobile-first-polish',
    'launch_polish',
    'Differentiation experiences remain mobile-first',
    'Cards, forms, and actions must remain readable and tappable on phone and tablet before launch.',
    true,
    'Mobile dashboard and support phases now expose the shared differentiation features in compact cards.'
  ),
];

export function getLaunchBlockingDifferentiationQaChecks(
  checks: readonly DifferentiationQaCheck[] = ORBIT_LEDGER_DIFFERENTIATION_QA_CHECKS
) {
  return checks.filter((check) => check.launchBlocking);
}

export function getDifferentiationQaReadiness(
  checks: readonly DifferentiationQaCheck[] = ORBIT_LEDGER_DIFFERENTIATION_QA_CHECKS
): DifferentiationQaReadiness {
  const missingEvidenceChecks = checks.filter((check) => check.evidence.trim().length === 0);
  const launchBlockingChecks = getLaunchBlockingDifferentiationQaChecks(checks);

  return {
    checkCount: checks.length,
    launchBlockingCheckCount: launchBlockingChecks.length,
    missingEvidenceCount: missingEvidenceChecks.length,
    readyForLaunchPolish: missingEvidenceChecks.length === 0 && launchBlockingChecks.length >= 10,
    launchBlockingChecks,
  };
}

function qaCheck(
  id: string,
  area: DifferentiationQaArea,
  label: string,
  expected: string,
  launchBlocking: boolean,
  evidence: string
): DifferentiationQaCheck {
  return {
    id,
    area,
    label,
    expected,
    launchBlocking,
    evidence,
  };
}
