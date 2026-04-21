import { getBusinessSettings, getFeatureToggles, listProducts } from '../database';
import { getDatabase } from '../database/client';
import type { Product } from '../database';
import type {
  InventoryReorderAction,
  InventoryReorderAssistantReport,
  InventoryReorderOptions,
  InventoryReorderSuggestion,
  ProductSalesVelocity,
  ReorderUrgency,
} from './types';

const DEFAULT_REORDER_OPTIONS: InventoryReorderOptions = {
  lowStockThreshold: 5,
  coverageDays: 30,
  salesWindowDays: 30,
};

type ProductSalesVelocityRow = {
  product_id: string;
  quantity_sold: number | null;
  invoice_count: number | null;
  last_sold_at: string | null;
};

export async function buildInventoryReorderAssistantReport(
  input: Partial<InventoryReorderOptions> = {}
): Promise<InventoryReorderAssistantReport> {
  const options = normalizeReorderOptions(input);
  const [business, featureToggles] = await Promise.all([
    getBusinessSettings(),
    getFeatureToggles(),
  ]);

  if (!business) {
    throw new Error('Business profile is required before building reorder suggestions.');
  }

  if (!featureToggles.invoices || !featureToggles.inventory) {
    throw new Error('Invoices and inventory must be enabled to use reorder suggestions.');
  }

  const products = await listProducts({ limit: 500 });
  const window = buildSalesWindow(options.salesWindowDays);
  const velocityMap = await loadProductSalesVelocity(window.from, window.to, options.salesWindowDays);
  const suggestions = products
    .map((product) => buildSuggestion(product, velocityMap.get(product.id), options))
    .sort(sortSuggestions);
  const totals = buildTotals(suggestions);

  return {
    business,
    generatedAt: new Date().toISOString(),
    window: {
      ...window,
      salesWindowDays: options.salesWindowDays,
      coverageDays: options.coverageDays,
      lowStockThreshold: options.lowStockThreshold,
    },
    totals,
    suggestions,
    actions: buildActions(suggestions, totals),
  };
}

export function normalizeReorderOptions(
  input: Partial<InventoryReorderOptions> = {}
): InventoryReorderOptions {
  return {
    lowStockThreshold: clampWholeNumber(input.lowStockThreshold, DEFAULT_REORDER_OPTIONS.lowStockThreshold, 0, 99999),
    coverageDays: clampWholeNumber(input.coverageDays, DEFAULT_REORDER_OPTIONS.coverageDays, 1, 365),
    salesWindowDays: clampWholeNumber(input.salesWindowDays, DEFAULT_REORDER_OPTIONS.salesWindowDays, 7, 365),
  };
}

async function loadProductSalesVelocity(
  from: string,
  to: string,
  salesWindowDays: number
): Promise<Map<string, ProductSalesVelocity>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ProductSalesVelocityRow>(
    `SELECT
      ii.product_id,
      SUM(ii.quantity) AS quantity_sold,
      COUNT(DISTINCT i.id) AS invoice_count,
      MAX(i.issue_date) AS last_sold_at
     FROM invoice_items ii
     INNER JOIN invoices i ON i.id = ii.invoice_id
     WHERE ii.product_id IS NOT NULL
      AND i.status != 'cancelled'
      AND i.issue_date >= ?
      AND i.issue_date <= ?
     GROUP BY ii.product_id`,
    from,
    to
  );

  return new Map(
    rows.map((row) => {
      const quantitySold = Number(row.quantity_sold ?? 0);
      return [
        row.product_id,
        {
          productId: row.product_id,
          quantitySold,
          invoiceCount: Number(row.invoice_count ?? 0),
          lastSoldAt: row.last_sold_at,
          dailyAverage: quantitySold > 0 ? quantitySold / salesWindowDays : 0,
        },
      ];
    })
  );
}

function buildSuggestion(
  product: Product,
  velocity: ProductSalesVelocity | undefined,
  options: InventoryReorderOptions
): InventoryReorderSuggestion {
  const dailyAverage = velocity?.dailyAverage ?? 0;
  const projectedDaysLeft =
    dailyAverage > 0 ? roundForDisplay(product.stockQuantity / dailyAverage, 1) : null;
  const targetStock = Math.max(options.lowStockThreshold * 2, dailyAverage * options.coverageDays);
  const suggestedReorderQuantity = Math.max(0, Math.ceil(targetStock - product.stockQuantity));
  const urgency = getUrgency(product.stockQuantity, projectedDaysLeft, options);

  return {
    product,
    urgency,
    urgencyLabel: getUrgencyLabel(urgency),
    reason: getReason(product, velocity, projectedDaysLeft, options, urgency),
    currentStock: product.stockQuantity,
    unit: product.unit,
    quantitySoldInWindow: velocity?.quantitySold ?? 0,
    invoiceCountInWindow: velocity?.invoiceCount ?? 0,
    dailyAverage: roundForDisplay(dailyAverage, 2),
    projectedDaysLeft,
    suggestedReorderQuantity,
    estimatedReorderCost: roundForDisplay(suggestedReorderQuantity * product.price, 2),
    lastSoldAt: velocity?.lastSoldAt ?? null,
  };
}

function getUrgency(
  stockQuantity: number,
  projectedDaysLeft: number | null,
  options: InventoryReorderOptions
): ReorderUrgency {
  if (stockQuantity <= 0) {
    return 'out_of_stock';
  }

  if (stockQuantity <= options.lowStockThreshold) {
    return 'reorder_now';
  }

  if (projectedDaysLeft !== null && projectedDaysLeft <= options.coverageDays) {
    return 'watch';
  }

  return 'healthy';
}

function getUrgencyLabel(urgency: ReorderUrgency): string {
  switch (urgency) {
    case 'out_of_stock':
      return 'Out of stock';
    case 'reorder_now':
      return 'Reorder now';
    case 'watch':
      return 'Watch';
    case 'healthy':
      return 'Healthy';
  }
}

function getReason(
  product: Product,
  velocity: ProductSalesVelocity | undefined,
  projectedDaysLeft: number | null,
  options: InventoryReorderOptions,
  urgency: ReorderUrgency
): string {
  if (urgency === 'out_of_stock') {
    return 'No stock left for invoice selection.';
  }

  if (urgency === 'reorder_now') {
    return `Stock is at or below ${options.lowStockThreshold} ${product.unit}.`;
  }

  if (urgency === 'watch' && projectedDaysLeft !== null) {
    return `Estimated ${projectedDaysLeft} days of stock left based on recent invoices.`;
  }

  if (!velocity || velocity.quantitySold <= 0) {
    return 'No recent invoice movement in the selected window.';
  }

  return 'Stock looks sufficient based on recent invoice movement.';
}

function buildTotals(suggestions: InventoryReorderSuggestion[]) {
  return {
    productsTracked: suggestions.length,
    activeSellingProducts: suggestions.filter((item) => item.quantitySoldInWindow > 0).length,
    outOfStockCount: suggestions.filter((item) => item.urgency === 'out_of_stock').length,
    reorderNowCount: suggestions.filter((item) => item.urgency === 'reorder_now').length,
    watchCount: suggestions.filter((item) => item.urgency === 'watch').length,
    healthyCount: suggestions.filter((item) => item.urgency === 'healthy').length,
    estimatedReorderCost: roundForDisplay(
      suggestions.reduce((sum, item) => sum + item.estimatedReorderCost, 0),
      2
    ),
  };
}

function buildActions(
  suggestions: InventoryReorderSuggestion[],
  totals: ReturnType<typeof buildTotals>
): InventoryReorderAction[] {
  const actions: InventoryReorderAction[] = [];

  if (totals.outOfStockCount > 0) {
    actions.push({
      id: 'restock_out_of_stock',
      title: 'Restock out-of-stock items',
      message: `${totals.outOfStockCount} product${totals.outOfStockCount === 1 ? '' : 's'} cannot be sold from stock right now.`,
      priority: 'high',
    });
  }

  if (totals.reorderNowCount > 0) {
    actions.push({
      id: 'reorder_low_stock',
      title: 'Prepare reorder list',
      message: `${totals.reorderNowCount} product${totals.reorderNowCount === 1 ? '' : 's'} reached the low-stock threshold.`,
      priority: 'high',
    });
  }

  if (totals.watchCount > 0) {
    actions.push({
      id: 'watch_fast_movers',
      title: 'Watch fast-moving items',
      message: `${totals.watchCount} product${totals.watchCount === 1 ? '' : 's'} may run low within the coverage window.`,
      priority: 'medium',
    });
  }

  const noMovementCount = suggestions.filter((item) => item.quantitySoldInWindow === 0).length;
  if (noMovementCount > 0) {
    actions.push({
      id: 'review_no_movement',
      title: 'Review slow inventory',
      message: `${noMovementCount} product${noMovementCount === 1 ? '' : 's'} had no invoice movement in the sales window.`,
      priority: 'low',
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: 'inventory_clear',
      title: 'Inventory looks balanced',
      message: 'No reorder action is needed based on current stock and recent invoice movement.',
      priority: 'low',
    });
  }

  return actions;
}

function buildSalesWindow(salesWindowDays: number): { from: string; to: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - salesWindowDays + 1);

  return {
    from: formatDateInput(start),
    to: formatDateInput(end),
  };
}

function sortSuggestions(
  left: InventoryReorderSuggestion,
  right: InventoryReorderSuggestion
): number {
  const urgencyWeight: Record<ReorderUrgency, number> = {
    out_of_stock: 0,
    reorder_now: 1,
    watch: 2,
    healthy: 3,
  };

  const urgencyDiff = urgencyWeight[left.urgency] - urgencyWeight[right.urgency];
  if (urgencyDiff !== 0) {
    return urgencyDiff;
  }

  return left.product.name.localeCompare(right.product.name);
}

function clampWholeNumber(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

function roundForDisplay(value: number, decimals: number): number {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function formatDateInput(date: Date): string {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}
