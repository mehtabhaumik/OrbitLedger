import type { BusinessSettings, Product } from '../database';

export type ReorderUrgency = 'out_of_stock' | 'reorder_now' | 'watch' | 'healthy';

export type InventoryReorderOptions = {
  lowStockThreshold: number;
  coverageDays: number;
  salesWindowDays: number;
};

export type ProductSalesVelocity = {
  productId: string;
  quantitySold: number;
  invoiceCount: number;
  lastSoldAt: string | null;
  dailyAverage: number;
};

export type InventoryReorderSuggestion = {
  product: Product;
  urgency: ReorderUrgency;
  urgencyLabel: string;
  reason: string;
  currentStock: number;
  unit: string;
  quantitySoldInWindow: number;
  invoiceCountInWindow: number;
  dailyAverage: number;
  projectedDaysLeft: number | null;
  suggestedReorderQuantity: number;
  estimatedReorderCost: number;
  lastSoldAt: string | null;
};

export type InventoryReorderTotals = {
  productsTracked: number;
  activeSellingProducts: number;
  outOfStockCount: number;
  reorderNowCount: number;
  watchCount: number;
  healthyCount: number;
  estimatedReorderCost: number;
};

export type InventoryReorderAction = {
  id: string;
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
};

export type InventoryReorderAssistantReport = {
  business: BusinessSettings;
  generatedAt: string;
  window: {
    from: string;
    to: string;
    salesWindowDays: number;
    coverageDays: number;
    lowStockThreshold: number;
  };
  totals: InventoryReorderTotals;
  suggestions: InventoryReorderSuggestion[];
  actions: InventoryReorderAction[];
};

export type InventoryReorderExportFormat = 'json' | 'csv';

export type SavedInventoryReorderExport = {
  fileName: string;
  uri: string;
  directoryUri: string;
  format: InventoryReorderExportFormat;
  mimeType: string;
  exportedAt: string;
  report: InventoryReorderAssistantReport;
};
