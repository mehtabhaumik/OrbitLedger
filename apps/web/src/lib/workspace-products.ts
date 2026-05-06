import type { WorkspaceProduct } from './workspace-data';

export type ProductStockUrgency = 'out_of_stock' | 'reorder_now' | 'watch' | 'healthy';

export type ProductInventorySummary = {
  productCount: number;
  totalStockUnits: number;
  inventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;
};

export type ProductReorderSuggestion = {
  product: WorkspaceProduct;
  urgency: ProductStockUrgency;
  urgencyLabel: string;
  reason: string;
  suggestedReorderQuantity: number;
  estimatedReorderCost: number;
};

export function summarizeWorkspaceProducts(
  products: WorkspaceProduct[],
  lowStockThreshold = 5
): ProductInventorySummary {
  return products.reduce<ProductInventorySummary>(
    (summary, product) => {
      const stockQuantity = normalizePositiveNumber(product.stockQuantity);
      const price = normalizePositiveNumber(product.price);
      summary.productCount += 1;
      summary.totalStockUnits += stockQuantity;
      summary.inventoryValue += stockQuantity * price;
      if (stockQuantity <= 0) {
        summary.outOfStockCount += 1;
      }
      if (stockQuantity <= lowStockThreshold) {
        summary.lowStockCount += 1;
      }
      return summary;
    },
    {
      productCount: 0,
      totalStockUnits: 0,
      inventoryValue: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
    }
  );
}

export function buildProductReorderSuggestions(
  products: WorkspaceProduct[],
  lowStockThreshold = 5,
  targetStock = 10
): ProductReorderSuggestion[] {
  return products
    .map((product) => {
      const urgency = getProductStockUrgency(product.stockQuantity, lowStockThreshold);
      const suggestedReorderQuantity =
        urgency === 'healthy' ? 0 : Math.max(0, Math.ceil(targetStock - product.stockQuantity));
      return {
        product,
        urgency,
        urgencyLabel: getProductStockUrgencyLabel(urgency),
        reason: getProductStockReason(product, urgency, lowStockThreshold),
        suggestedReorderQuantity,
        estimatedReorderCost: roundForDisplay(suggestedReorderQuantity * product.price, 2),
      };
    })
    .sort((left, right) => {
      const weight: Record<ProductStockUrgency, number> = {
        out_of_stock: 0,
        reorder_now: 1,
        watch: 2,
        healthy: 3,
      };
      return (
        weight[left.urgency] - weight[right.urgency] ||
        left.product.name.localeCompare(right.product.name)
      );
    });
}

export function getProductStockUrgency(stockQuantity: number, lowStockThreshold = 5): ProductStockUrgency {
  if (stockQuantity <= 0) {
    return 'out_of_stock';
  }
  if (stockQuantity <= lowStockThreshold) {
    return 'reorder_now';
  }
  if (stockQuantity <= lowStockThreshold * 2) {
    return 'watch';
  }
  return 'healthy';
}

export function getProductStockUrgencyLabel(urgency: ProductStockUrgency): string {
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

export function productStatusTone(urgency: ProductStockUrgency): 'warning' | 'success' | 'primary' {
  if (urgency === 'out_of_stock' || urgency === 'reorder_now') {
    return 'warning';
  }
  if (urgency === 'healthy') {
    return 'success';
  }
  return 'primary';
}

export function buildProductsCsv(products: WorkspaceProduct[]): string {
  return buildCsvLine(['Name', 'Price', 'Stock', 'Unit', 'Status', 'Created at']).concat(
    '\n',
    products
      .map((product) =>
        buildCsvLine([
          product.name,
          product.price,
          product.stockQuantity,
          product.unit,
          getProductStockUrgencyLabel(getProductStockUrgency(product.stockQuantity)),
          product.createdAt,
        ])
      )
      .join('\n')
  );
}

function getProductStockReason(
  product: WorkspaceProduct,
  urgency: ProductStockUrgency,
  lowStockThreshold: number
): string {
  if (urgency === 'out_of_stock') {
    return 'No stock left for invoice selection.';
  }
  if (urgency === 'reorder_now') {
    return `Stock is at or below ${lowStockThreshold} ${product.unit}.`;
  }
  if (urgency === 'watch') {
    return 'Stock is above the alert level but close enough to watch.';
  }
  return 'Stock looks ready for invoices.';
}

function buildCsvLine(values: Array<string | number | null | undefined>): string {
  return values
    .map((value) => {
      const text = String(value ?? '');
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    })
    .join(',');
}

function normalizePositiveNumber(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function roundForDisplay(value: number, decimals: number): number {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}
