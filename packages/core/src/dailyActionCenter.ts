export type DailyActionCenterArea =
  | 'collections'
  | 'invoices'
  | 'inventory'
  | 'payments'
  | 'backup'
  | 'business_health'
  | 'daily_closing';

export type DailyActionCenterTone = 'success' | 'primary' | 'warning' | 'danger';

export type DailyActionCenterPriority = 'critical' | 'high' | 'normal' | 'low';

export type DailyActionCenterActionTarget =
  | 'open_collections'
  | 'open_invoices'
  | 'open_inventory'
  | 'open_payment_review'
  | 'open_backup'
  | 'open_business_health'
  | 'open_daily_closing';

export type DailyActionCenterAction = {
  label: string;
  target: DailyActionCenterActionTarget;
  detailDialog: string;
};

export type DailyActionCenterItem = {
  id: DailyActionCenterArea;
  title: string;
  message: string;
  value: string;
  priority: DailyActionCenterPriority;
  score: number;
  tone: DailyActionCenterTone;
  action: DailyActionCenterAction;
};

export type DailyActionCenterOutput = {
  title: string;
  summary: string;
  topAction: DailyActionCenterItem;
  items: DailyActionCenterItem[];
  emptyState: boolean;
};

export type DailyCollectionsSignal = {
  customerCount?: number | null;
  amountDue?: number | null;
};

export type DailyInvoiceSignal = {
  invoiceCount?: number | null;
  overdueCount?: number | null;
  amountDue?: number | null;
};

export type DailyInventorySignal = {
  lowStockCount?: number | null;
  outOfStockCount?: number | null;
};

export type DailyPaymentSignal = {
  pendingVerificationCount?: number | null;
  pendingClearanceCount?: number | null;
};

export type DailyBackupSignal = {
  status?: 'healthy' | 'missing' | 'old' | 'failed' | null;
  ageHours?: number | null;
};

export type DailyBusinessTrendSignal = {
  currentWeekAmount?: number | null;
  previousWeekAmount?: number | null;
  deltaPercent?: number | null;
};

export type DailyClosingSignal = {
  completedToday?: boolean | null;
  openItemCount?: number | null;
};

export type DailyActionCenterInput = {
  businessName?: string | null;
  currency?: string | null;
  collections?: DailyCollectionsSignal | null;
  invoices?: DailyInvoiceSignal | null;
  inventory?: DailyInventorySignal | null;
  payments?: DailyPaymentSignal | null;
  backup?: DailyBackupSignal | null;
  businessTrend?: DailyBusinessTrendSignal | null;
  closing?: DailyClosingSignal | null;
};

export type DailyActionCenterSurfaceBlueprint = {
  area: DailyActionCenterArea;
  label: string;
  promise: string;
  requiredData: string[];
  actionTarget: DailyActionCenterActionTarget;
};

export const DAILY_ACTION_CENTER_SURFACES: DailyActionCenterSurfaceBlueprint[] = [
  surface(
    'collections',
    'Collections',
    'Show who should be contacted first and how much is at stake today.',
    ['due customer count', 'due amount', 'customer follow-up list'],
    'open_collections'
  ),
  surface(
    'invoices',
    'Unpaid invoices',
    'Show unpaid and overdue invoice work that needs review.',
    ['unpaid invoice count', 'overdue invoice count', 'unpaid amount'],
    'open_invoices'
  ),
  surface(
    'inventory',
    'Stock attention',
    'Show products that may block sales or need purchase planning.',
    ['low-stock count', 'out-of-stock count', 'product list'],
    'open_inventory'
  ),
  surface(
    'payments',
    'Payment review',
    'Show payments that need verification before balances are trusted.',
    ['pending verification count', 'pending clearance count', 'payment review list'],
    'open_payment_review'
  ),
  surface(
    'backup',
    'Backup health',
    'Show whether business records are protected today.',
    ['backup status', 'backup age', 'last backup result'],
    'open_backup'
  ),
  surface(
    'business_health',
    'Business health',
    'Show whether this week is healthier than last week.',
    ['current week value', 'previous week value', 'trend percent'],
    'open_business_health'
  ),
  surface(
    'daily_closing',
    'Daily closing',
    'Show whether today is ready to close cleanly.',
    ['closing status', 'open closing item count'],
    'open_daily_closing'
  ),
];

export function buildDailyActionCenter(input: DailyActionCenterInput): DailyActionCenterOutput {
  const currency = normalizeCurrency(input.currency);
  const items = [
    buildPaymentReviewItem(input.payments),
    buildCollectionsItem(input.collections, currency),
    buildInvoicesItem(input.invoices, currency),
    buildInventoryItem(input.inventory),
    buildBackupItem(input.backup),
    buildBusinessTrendItem(input.businessTrend, currency),
    buildDailyClosingItem(input.closing),
  ]
    .filter(isDailyActionCenterItem)
    .sort((left, right) => right.score - left.score);

  if (items.length === 0) {
    const fallback = buildFallbackItem();
    return {
      title: buildTitle(input.businessName),
      summary: 'No urgent work needs attention right now.',
      topAction: fallback,
      items: [fallback],
      emptyState: true,
    };
  }

  return {
    title: buildTitle(input.businessName),
    summary: buildSummary(items),
    topAction: items[0],
    items,
    emptyState: false,
  };
}

function buildPaymentReviewItem(signal?: DailyPaymentSignal | null): DailyActionCenterItem | null {
  const pendingVerification = count(signal?.pendingVerificationCount);
  const pendingClearance = count(signal?.pendingClearanceCount);
  const total = pendingVerification + pendingClearance;

  if (total === 0) {
    return null;
  }

  const message =
    pendingVerification > 0
      ? `${pendingVerification} payment${plural(pendingVerification)} need${pendingVerification === 1 ? 's' : ''} review before balances are updated.`
      : `${pendingClearance} payment${plural(pendingClearance)} are waiting for clearance.`;

  return item({
    id: 'payments',
    title: 'Review payments',
    message,
    value: String(total),
    priority: pendingVerification > 0 ? 'critical' : 'high',
    score: pendingVerification > 0 ? 112 : 96,
    tone: pendingVerification > 0 ? 'danger' : 'warning',
    actionLabel: 'Review payments',
    target: 'open_payment_review',
    detailDialog: 'payment_review_list',
  });
}

function buildCollectionsItem(
  signal: DailyCollectionsSignal | null | undefined,
  currency: string
): DailyActionCenterItem | null {
  const customerCount = count(signal?.customerCount);
  const amountDue = money(signal?.amountDue);

  if (customerCount === 0 && amountDue === 0) {
    return null;
  }

  return item({
    id: 'collections',
    title: 'Collect today',
    message:
      customerCount > 0
        ? `${customerCount} customer${plural(customerCount)} should be followed up today.`
        : 'Review today’s collection queue.',
    value: amountDue > 0 ? formatMoney(amountDue, currency) : String(customerCount),
    priority: 'high',
    score: 104,
    tone: 'warning',
    actionLabel: 'Open collections',
    target: 'open_collections',
    detailDialog: 'collection_customer_list',
  });
}

function buildInvoicesItem(
  signal: DailyInvoiceSignal | null | undefined,
  currency: string
): DailyActionCenterItem | null {
  const invoiceCount = count(signal?.invoiceCount);
  const overdueCount = count(signal?.overdueCount);
  const amountDue = money(signal?.amountDue);

  if (invoiceCount === 0 && overdueCount === 0 && amountDue === 0) {
    return null;
  }

  return item({
    id: 'invoices',
    title: overdueCount > 0 ? 'Overdue invoices' : 'Unpaid invoices',
    message:
      overdueCount > 0
        ? `${overdueCount} invoice${plural(overdueCount)} need${overdueCount === 1 ? 's' : ''} attention.`
        : `${invoiceCount} unpaid invoice${plural(invoiceCount)} should be reviewed.`,
    value: amountDue > 0 ? formatMoney(amountDue, currency) : String(overdueCount || invoiceCount),
    priority: overdueCount > 0 ? 'critical' : 'high',
    score: overdueCount > 0 ? 108 : 94,
    tone: overdueCount > 0 ? 'danger' : 'warning',
    actionLabel: 'Review invoices',
    target: 'open_invoices',
    detailDialog: 'unpaid_invoice_list',
  });
}

function buildInventoryItem(signal?: DailyInventorySignal | null): DailyActionCenterItem | null {
  const lowStock = count(signal?.lowStockCount);
  const outOfStock = count(signal?.outOfStockCount);
  const total = lowStock + outOfStock;

  if (total === 0) {
    return null;
  }

  return item({
    id: 'inventory',
    title: outOfStock > 0 ? 'Stock needs attention' : 'Low stock',
    message:
      outOfStock > 0
        ? `${outOfStock} product${plural(outOfStock)} may block sales.`
        : `${lowStock} product${plural(lowStock)} should be reviewed before stock runs low.`,
    value: String(total),
    priority: outOfStock > 0 ? 'high' : 'normal',
    score: outOfStock > 0 ? 92 : 78,
    tone: 'warning',
    actionLabel: 'Review stock',
    target: 'open_inventory',
    detailDialog: 'stock_attention_list',
  });
}

function buildBackupItem(signal?: DailyBackupSignal | null): DailyActionCenterItem | null {
  const ageHours = signal?.ageHours;
  const status = signal?.status;
  const oldBackup = typeof ageHours === 'number' && ageHours >= 48;

  if (!status && !oldBackup) {
    return null;
  }
  if (status === 'healthy' && !oldBackup) {
    return null;
  }

  const failed = status === 'failed';
  const missing = status === 'missing';
  return item({
    id: 'backup',
    title: failed ? 'Backup needs review' : missing ? 'Backup not set' : 'Backup is due',
    message: failed
      ? 'The last backup did not finish successfully.'
      : missing
        ? 'Set up backup protection for this workspace.'
        : 'Your records have not been backed up recently.',
    value: failed ? 'Review' : missing ? 'Set up' : `${Math.floor(Number(ageHours ?? 0) / 24)}d`,
    priority: failed || missing ? 'critical' : 'normal',
    score: failed || missing ? 98 : 74,
    tone: failed || missing ? 'danger' : 'warning',
    actionLabel: failed || missing ? 'Open backup' : 'Check backup',
    target: 'open_backup',
    detailDialog: 'backup_health_details',
  });
}

function buildBusinessTrendItem(
  signal: DailyBusinessTrendSignal | null | undefined,
  currency: string
): DailyActionCenterItem | null {
  const current = money(signal?.currentWeekAmount);
  const previous = money(signal?.previousWeekAmount);
  const explicitDelta = signal?.deltaPercent;
  const deltaPercent =
    typeof explicitDelta === 'number'
      ? explicitDelta
      : previous > 0
        ? ((current - previous) / previous) * 100
        : null;

  if (deltaPercent === null || Math.abs(deltaPercent) < 1) {
    return null;
  }

  const down = deltaPercent < 0;
  return item({
    id: 'business_health',
    title: down ? 'Business is slower this week' : 'Business is ahead this week',
    message: down
      ? 'Review collections, invoice activity, and pending payments.'
      : 'Keep today’s records updated so the trend stays clear.',
    value: down ? `${Math.round(Math.abs(deltaPercent))}% down` : `${Math.round(deltaPercent)}% up`,
    priority: down ? 'normal' : 'low',
    score: down ? 64 : 42,
    tone: down ? 'warning' : 'success',
    actionLabel: 'View health',
    target: 'open_business_health',
    detailDialog: 'business_health_summary',
  });
}

function buildDailyClosingItem(signal?: DailyClosingSignal | null): DailyActionCenterItem | null {
  const openItems = count(signal?.openItemCount);

  if (signal?.completedToday === true) {
    return null;
  }
  if (openItems === 0 && signal?.completedToday !== false) {
    return null;
  }

  return item({
    id: 'daily_closing',
    title: 'Close today cleanly',
    message:
      openItems > 0
        ? `${openItems} item${plural(openItems)} should be checked before closing.`
        : 'Review today’s collections, payments, and open follow-ups.',
    value: openItems > 0 ? String(openItems) : 'Open',
    priority: 'normal',
    score: 58,
    tone: 'primary',
    actionLabel: 'Start closing',
    target: 'open_daily_closing',
    detailDialog: 'daily_closing_checklist',
  });
}

function buildFallbackItem(): DailyActionCenterItem {
  return item({
    id: 'daily_closing',
    title: 'Ready for today',
    message: 'No urgent collections, payments, stock, or backup items need attention right now.',
    value: 'Clear',
    priority: 'low',
    score: 10,
    tone: 'success',
    actionLabel: 'Review closing',
    target: 'open_daily_closing',
    detailDialog: 'daily_closing_checklist',
  });
}

function item(input: {
  id: DailyActionCenterArea;
  title: string;
  message: string;
  value: string;
  priority: DailyActionCenterPriority;
  score: number;
  tone: DailyActionCenterTone;
  actionLabel: string;
  target: DailyActionCenterActionTarget;
  detailDialog: string;
}): DailyActionCenterItem {
  return {
    id: input.id,
    title: input.title,
    message: input.message,
    value: input.value,
    priority: input.priority,
    score: input.score,
    tone: input.tone,
    action: {
      label: input.actionLabel,
      target: input.target,
      detailDialog: input.detailDialog,
    },
  };
}

function surface(
  area: DailyActionCenterArea,
  label: string,
  promise: string,
  requiredData: string[],
  actionTarget: DailyActionCenterActionTarget
): DailyActionCenterSurfaceBlueprint {
  return {
    area,
    label,
    promise,
    requiredData,
    actionTarget,
  };
}

function buildTitle(businessName?: string | null): string {
  const cleanName = businessName?.trim();
  return cleanName ? `${cleanName} today` : 'Today in Orbit Ledger';
}

function buildSummary(items: DailyActionCenterItem[]): string {
  const criticalCount = items.filter((item) => item.priority === 'critical').length;
  if (criticalCount > 0) {
    return `${criticalCount} urgent item${plural(criticalCount)} should be handled first.`;
  }
  return `${items.length} action${plural(items.length)} can help keep the day on track.`;
}

function normalizeCurrency(value?: string | null): string {
  return value && /^[A-Z]{3}$/.test(value) ? value : 'INR';
}

function count(value?: number | null): number {
  return Math.max(0, Math.floor(Number.isFinite(Number(value)) ? Number(value) : 0));
}

function money(value?: number | null): number {
  return Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    currency,
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

function plural(value: number): string {
  return value === 1 ? '' : 's';
}

function isDailyActionCenterItem(
  value: DailyActionCenterItem | null
): value is DailyActionCenterItem {
  return value !== null;
}
