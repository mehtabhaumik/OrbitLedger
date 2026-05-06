export type BusinessHealthScoreTone = 'healthy' | 'watch' | 'action' | 'critical';
export type BusinessHealthScoreGrade = 'excellent' | 'steady' | 'watch' | 'needs_action' | 'at_risk';
export type BusinessHealthScorePriority = 'critical' | 'high' | 'medium' | 'low';

export type BusinessHealthScoreArea =
  | 'collections'
  | 'invoices'
  | 'payments'
  | 'inventory'
  | 'backup'
  | 'documents'
  | 'local_setup'
  | 'daily_rhythm';

export type BusinessHealthScoreActionTarget =
  | 'open_collection_coach'
  | 'open_invoices'
  | 'open_payment_review'
  | 'open_inventory'
  | 'open_backup'
  | 'open_documents'
  | 'open_local_settings'
  | 'open_daily_closing';

export type BusinessHealthScoreSignal = {
  receivableAmount?: number | null;
  receivableChangeAmount?: number | null;
  customerCount?: number | null;
  riskyCustomerCount?: number | null;
  overdueCustomerCount?: number | null;
  unpaidInvoiceCount?: number | null;
  overdueInvoiceCount?: number | null;
  pendingPaymentCount?: number | null;
  pendingClearanceCount?: number | null;
  lowStockCount?: number | null;
  outOfStockCount?: number | null;
  backupStatus?: 'healthy' | 'missing' | 'old' | 'failed' | null;
  documentReadinessIssues?: number | null;
  localSetupIssues?: number | null;
  dailyClosingOpenItems?: number | null;
  collectionRatePercent?: number | null;
};

export type BusinessHealthScoreFactor = {
  area: BusinessHealthScoreArea;
  label: string;
  valueLabel: string;
  impact: number;
  priority: BusinessHealthScorePriority;
  tone: BusinessHealthScoreTone;
  message: string;
  actionLabel: string;
  actionTarget: BusinessHealthScoreActionTarget;
};

export type BusinessHealthScoreOutput = {
  title: string;
  score: number;
  grade: BusinessHealthScoreGrade;
  label: string;
  tone: BusinessHealthScoreTone;
  summary: string;
  topFactor: BusinessHealthScoreFactor | null;
  factors: BusinessHealthScoreFactor[];
  positiveSignals: string[];
  guardrails: string[];
};

export type BusinessHealthScoreSurfaceBlueprint = {
  area: BusinessHealthScoreArea;
  label: string;
  userPromise: string;
  requiredData: string[];
  actionTarget: BusinessHealthScoreActionTarget;
};

export type BusinessHealthScoreActionFlow = {
  target: BusinessHealthScoreActionTarget;
  label: string;
  userGoal: string;
  primaryActionLabel: string;
  webRoute: string;
  mobileScreen: string;
  completionSignal: string;
};

export const BUSINESS_HEALTH_SCORE_SURFACES: BusinessHealthScoreSurfaceBlueprint[] = [
  surface('collections', 'Collections', 'Measure whether money owed is getting follow-up before it becomes stale.', [
    'receivable amount',
    'risky customers',
    'overdue customers',
    'collection rate',
  ], 'open_collection_coach'),
  surface('invoices', 'Invoices', 'Measure unpaid, overdue, and review-needed invoice work.', [
    'unpaid invoice count',
    'overdue invoice count',
    'invoice payment state',
  ], 'open_invoices'),
  surface('payments', 'Payment verification', 'Measure whether received money is trusted and cleared.', [
    'pending payment count',
    'pending clearance count',
    'manual review queue',
  ], 'open_payment_review'),
  surface('inventory', 'Inventory pressure', 'Measure whether stock can block sales or delivery.', [
    'low stock count',
    'out of stock count',
    'stock units',
  ], 'open_inventory'),
  surface('backup', 'Backup safety', 'Measure whether business records are protected.', [
    'backup status',
    'backup age',
    'last backup result',
  ], 'open_backup'),
  surface('documents', 'Document readiness', 'Measure whether invoices, statements, payment notices, and exports are ready to send.', [
    'document defaults',
    'template settings',
    'export readiness',
  ], 'open_documents'),
  surface('local_setup', 'Local setup', 'Measure whether tax, payment wording, currency, and country details are locally ready.', [
    'country',
    'tax setup',
    'payment instructions',
    'currency',
  ], 'open_local_settings'),
  surface('daily_rhythm', 'Daily rhythm', 'Measure whether the day can be closed without loose ends.', [
    'daily closing open items',
    'today review state',
  ], 'open_daily_closing'),
];

export const BUSINESS_HEALTH_SCORE_ACTION_FLOWS: BusinessHealthScoreActionFlow[] = [
  actionFlow({
    target: 'open_collection_coach',
    label: 'Collection coach',
    userGoal: 'Choose the customers to follow up before receivables become stale.',
    primaryActionLabel: 'Review customers',
    webRoute: '/reports#business-health',
    mobileScreen: 'GetPaid',
    completionSignal: 'Customer follow-up list reviewed or customer opened.',
  }),
  actionFlow({
    target: 'open_invoices',
    label: 'Invoice review',
    userGoal: 'Open unpaid or overdue invoices and decide whether to view, print, revise, or record payment.',
    primaryActionLabel: 'Review invoices',
    webRoute: '/invoices',
    mobileScreen: 'Invoices',
    completionSignal: 'Invoice opened, paid, revised, cancelled, or reviewed.',
  }),
  actionFlow({
    target: 'open_payment_review',
    label: 'Payment review',
    userGoal: 'Verify received payments before balances and invoice states are trusted.',
    primaryActionLabel: 'Review payments',
    webRoute: '/payments',
    mobileScreen: 'PaymentProviderEvents',
    completionSignal: 'Payment cleared, corrected, bounced, reversed, or left for follow-up.',
  }),
  actionFlow({
    target: 'open_inventory',
    label: 'Inventory review',
    userGoal: 'Check low or out-of-stock items before creating invoices or promising delivery.',
    primaryActionLabel: 'Review stock',
    webRoute: '/products',
    mobileScreen: 'Products',
    completionSignal: 'Product stock reviewed or reorder action started.',
  }),
  actionFlow({
    target: 'open_backup',
    label: 'Backup review',
    userGoal: 'Protect the workspace before more business records are added.',
    primaryActionLabel: 'Open backup',
    webRoute: '/backup',
    mobileScreen: 'BackupRestore',
    completionSignal: 'Backup exported, restore reviewed, or backup reminder checked.',
  }),
  actionFlow({
    target: 'open_documents',
    label: 'Document review',
    userGoal: 'Review invoices, statements, payment notices, templates, and exports before sending.',
    primaryActionLabel: 'Review documents',
    webRoute: '/documents',
    mobileScreen: 'StatementBatch',
    completionSignal: 'Document previewed, exported, sent, or settings reviewed.',
  }),
  actionFlow({
    target: 'open_local_settings',
    label: 'Local setup review',
    userGoal: 'Confirm country, currency, tax labels, payment details, and document defaults.',
    primaryActionLabel: 'Review settings',
    webRoute: '/settings#invoice-document-settings',
    mobileScreen: 'BusinessProfileSettings',
    completionSignal: 'Local tax, payment, document, or business settings saved.',
  }),
  actionFlow({
    target: 'open_daily_closing',
    label: 'Daily closing',
    userGoal: 'Close the day with trusted payments, credit, stock, follow-up, and backup signals.',
    primaryActionLabel: 'Review daily close',
    webRoute: '/reports#daily-closing-review',
    mobileScreen: 'DailyClosingReport',
    completionSignal: 'Daily closing review opened or saved.',
  }),
];

export const BUSINESS_HEALTH_SCORE_GUARDRAILS = [
  'The score must explain what changed and what to do next.',
  'A low score should never shame the business owner; it should point to recoverable actions.',
  'Money-impacting actions must link to review flows, not silently change records.',
  'Tax, local, and audit signals should use review wording and avoid legal guarantees.',
  'The score should be recalculated from saved business data and never manually typed by the user.',
  'Mobile and web may show different layouts, but the score meaning and factors must match.',
];

export function getBusinessHealthScoreActionFlow(
  target: BusinessHealthScoreActionTarget
): BusinessHealthScoreActionFlow {
  return BUSINESS_HEALTH_SCORE_ACTION_FLOWS.find((flow) => flow.target === target) ?? BUSINESS_HEALTH_SCORE_ACTION_FLOWS[0]!;
}

export function buildBusinessHealthScore(input: {
  businessName?: string | null;
  currency?: string | null;
  signal?: BusinessHealthScoreSignal | null;
}): BusinessHealthScoreOutput {
  const signal = input.signal ?? {};
  const factors = [
    buildCollectionFactor(signal),
    buildInvoiceFactor(signal),
    buildPaymentFactor(signal),
    buildInventoryFactor(signal),
    buildBackupFactor(signal),
    buildDocumentFactor(signal),
    buildLocalSetupFactor(signal),
    buildDailyRhythmFactor(signal),
  ]
    .filter(isBusinessHealthScoreFactor)
    .sort((left, right) => right.impact - left.impact || left.label.localeCompare(right.label));
  const score = clampScore(100 - factors.reduce((total, factor) => total + factor.impact, 0));
  const grade = getGrade(score);
  const tone = getTone(score);

  return {
    title: `${input.businessName?.trim() || 'Business'} health score`,
    score,
    grade,
    label: getLabel(grade),
    tone,
    summary: buildSummary(score, factors),
    topFactor: factors[0] ?? null,
    factors,
    positiveSignals: buildPositiveSignals(signal, factors),
    guardrails: BUSINESS_HEALTH_SCORE_GUARDRAILS,
  };
}

function buildCollectionFactor(signal: BusinessHealthScoreSignal): BusinessHealthScoreFactor | null {
  const riskyCustomers = count(signal.riskyCustomerCount);
  const overdueCustomers = count(signal.overdueCustomerCount);
  const receivableChange = amount(signal.receivableChangeAmount);
  const collectionRate = percent(signal.collectionRatePercent);
  const issueCount = riskyCustomers + overdueCustomers;
  if (issueCount === 0 && receivableChange <= 0 && collectionRate >= 55) {
    return null;
  }
  const impact = Math.min(34, riskyCustomers * 7 + overdueCustomers * 6 + (receivableChange > 0 ? 8 : 0) + (collectionRate < 35 ? 10 : 0));
  return factor({
    area: 'collections',
    label: 'Collections need attention',
    valueLabel: issueCount > 0 ? `${issueCount} customer${plural(issueCount)}` : `${collectionRate}% collection rate`,
    impact,
    priority: impact >= 24 ? 'critical' : 'high',
    tone: impact >= 24 ? 'critical' : 'action',
    message: issueCount > 0 ? 'Some customers need follow-up before receivables become stale.' : 'Payments are not keeping pace with open dues.',
    actionLabel: 'Open collection coach',
    actionTarget: 'open_collection_coach',
  });
}

function buildInvoiceFactor(signal: BusinessHealthScoreSignal): BusinessHealthScoreFactor | null {
  const unpaidInvoices = count(signal.unpaidInvoiceCount);
  const overdueInvoices = count(signal.overdueInvoiceCount);
  if (unpaidInvoices + overdueInvoices === 0) {
    return null;
  }
  const impact = Math.min(24, unpaidInvoices * 3 + overdueInvoices * 7);
  return factor({
    area: 'invoices',
    label: overdueInvoices > 0 ? 'Overdue invoices are waiting' : 'Unpaid invoices are waiting',
    valueLabel: `${overdueInvoices || unpaidInvoices} invoice${plural(overdueInvoices || unpaidInvoices)}`,
    impact,
    priority: overdueInvoices > 0 ? 'high' : 'medium',
    tone: overdueInvoices > 0 ? 'action' : 'watch',
    message: overdueInvoices > 0 ? 'Review overdue invoices and send the right notice or statement.' : 'Review unpaid invoices before they become overdue.',
    actionLabel: 'Open invoices',
    actionTarget: 'open_invoices',
  });
}

function buildPaymentFactor(signal: BusinessHealthScoreSignal): BusinessHealthScoreFactor | null {
  const pendingPayments = count(signal.pendingPaymentCount);
  const pendingClearance = count(signal.pendingClearanceCount);
  const total = pendingPayments + pendingClearance;
  if (total === 0) {
    return null;
  }
  const impact = Math.min(22, pendingPayments * 6 + pendingClearance * 4);
  return factor({
    area: 'payments',
    label: 'Payments need verification',
    valueLabel: `${total} payment${plural(total)}`,
    impact,
    priority: pendingPayments > 0 ? 'high' : 'medium',
    tone: pendingPayments > 0 ? 'action' : 'watch',
    message: 'Verify payment status before balances and invoice states are trusted.',
    actionLabel: 'Open payment review',
    actionTarget: 'open_payment_review',
  });
}

function buildInventoryFactor(signal: BusinessHealthScoreSignal): BusinessHealthScoreFactor | null {
  const lowStock = count(signal.lowStockCount);
  const outOfStock = count(signal.outOfStockCount);
  if (lowStock + outOfStock === 0) {
    return null;
  }
  const impact = Math.min(18, lowStock * 3 + outOfStock * 7);
  return factor({
    area: 'inventory',
    label: outOfStock > 0 ? 'Stock may block sales' : 'Stock needs review',
    valueLabel: `${outOfStock || lowStock} item${plural(outOfStock || lowStock)}`,
    impact,
    priority: outOfStock > 0 ? 'high' : 'medium',
    tone: outOfStock > 0 ? 'action' : 'watch',
    message: 'Review stock before customers are affected.',
    actionLabel: 'Open inventory',
    actionTarget: 'open_inventory',
  });
}

function buildBackupFactor(signal: BusinessHealthScoreSignal): BusinessHealthScoreFactor | null {
  const status = signal.backupStatus ?? 'healthy';
  if (status === 'healthy') {
    return null;
  }
  const impact = status === 'failed' || status === 'missing' ? 24 : 12;
  return factor({
    area: 'backup',
    label: status === 'old' ? 'Backup needs refresh' : 'Backup protection needs review',
    valueLabel: status,
    impact,
    priority: impact >= 24 ? 'critical' : 'medium',
    tone: impact >= 24 ? 'critical' : 'watch',
    message: 'Protect business records before more work is added.',
    actionLabel: 'Open backup',
    actionTarget: 'open_backup',
  });
}

function buildDocumentFactor(signal: BusinessHealthScoreSignal): BusinessHealthScoreFactor | null {
  const issues = count(signal.documentReadinessIssues);
  if (issues === 0) {
    return null;
  }
  return factor({
    area: 'documents',
    label: 'Documents need polish',
    valueLabel: `${issues} item${plural(issues)}`,
    impact: Math.min(14, issues * 4),
    priority: 'medium',
    tone: 'watch',
    message: 'Review templates, exports, and payment wording before sending documents.',
    actionLabel: 'Open documents',
    actionTarget: 'open_documents',
  });
}

function buildLocalSetupFactor(signal: BusinessHealthScoreSignal): BusinessHealthScoreFactor | null {
  const issues = count(signal.localSetupIssues);
  if (issues === 0) {
    return null;
  }
  return factor({
    area: 'local_setup',
    label: 'Local setup needs review',
    valueLabel: `${issues} item${plural(issues)}`,
    impact: Math.min(16, issues * 5),
    priority: 'medium',
    tone: 'watch',
    message: 'Review local tax, payment, currency, and document settings.',
    actionLabel: 'Open local settings',
    actionTarget: 'open_local_settings',
  });
}

function buildDailyRhythmFactor(signal: BusinessHealthScoreSignal): BusinessHealthScoreFactor | null {
  const openItems = count(signal.dailyClosingOpenItems);
  if (openItems === 0) {
    return null;
  }
  return factor({
    area: 'daily_rhythm',
    label: 'Daily close has open items',
    valueLabel: `${openItems} check${plural(openItems)}`,
    impact: Math.min(12, openItems * 3),
    priority: 'low',
    tone: 'watch',
    message: 'Close the day so tomorrow starts with trusted numbers.',
    actionLabel: 'Open daily closing',
    actionTarget: 'open_daily_closing',
  });
}

function buildPositiveSignals(signal: BusinessHealthScoreSignal, factors: BusinessHealthScoreFactor[]): string[] {
  const factorAreas = new Set(factors.map((factorItem) => factorItem.area));
  const signals: string[] = [];
  if (!factorAreas.has('payments')) {
    signals.push('Payments do not need urgent verification.');
  }
  if (!factorAreas.has('backup')) {
    signals.push('Backup protection looks healthy.');
  }
  if (!factorAreas.has('inventory')) {
    signals.push('Inventory does not show urgent stock pressure.');
  }
  if (count(signal.customerCount) > 0 && !factorAreas.has('collections')) {
    signals.push('Customer collection signals look steady.');
  }
  return signals.slice(0, 4);
}

function buildSummary(score: number, factors: BusinessHealthScoreFactor[]): string {
  if (!factors.length) {
    return 'Business health looks steady across collections, payments, documents, and daily review.';
  }
  const top = factors[0]!;
  if (score < 45) {
    return `${top.label} should be handled first. The score can recover as open items are reviewed.`;
  }
  if (score < 72) {
    return `${factors.length} business signal${plural(factors.length)} need review before the day feels fully under control.`;
  }
  return 'A few useful checks can make the business even cleaner today.';
}

function factor(input: BusinessHealthScoreFactor): BusinessHealthScoreFactor {
  return input;
}

function surface(
  area: BusinessHealthScoreArea,
  label: string,
  userPromise: string,
  requiredData: string[],
  actionTarget: BusinessHealthScoreActionTarget
): BusinessHealthScoreSurfaceBlueprint {
  return {
    area,
    label,
    userPromise,
    requiredData,
    actionTarget,
  };
}

function actionFlow(input: BusinessHealthScoreActionFlow): BusinessHealthScoreActionFlow {
  return input;
}

function getGrade(score: number): BusinessHealthScoreGrade {
  if (score >= 90) {
    return 'excellent';
  }
  if (score >= 76) {
    return 'steady';
  }
  if (score >= 58) {
    return 'watch';
  }
  if (score >= 40) {
    return 'needs_action';
  }
  return 'at_risk';
}

function getTone(score: number): BusinessHealthScoreTone {
  if (score >= 76) {
    return 'healthy';
  }
  if (score >= 58) {
    return 'watch';
  }
  if (score >= 40) {
    return 'action';
  }
  return 'critical';
}

function getLabel(grade: BusinessHealthScoreGrade): string {
  const labels: Record<BusinessHealthScoreGrade, string> = {
    excellent: 'Excellent',
    steady: 'Steady',
    watch: 'Watch closely',
    needs_action: 'Needs action',
    at_risk: 'At risk',
  };
  return labels[grade];
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function count(value?: number | null): number {
  return Number.isFinite(value) && value && value > 0 ? Math.floor(value) : 0;
}

function amount(value?: number | null): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function percent(value?: number | null): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(Number(value)))) : 100;
}

function plural(countValue: number): string {
  return countValue === 1 ? '' : 's';
}

function isBusinessHealthScoreFactor(
  value: BusinessHealthScoreFactor | null
): value is BusinessHealthScoreFactor {
  return value !== null;
}
