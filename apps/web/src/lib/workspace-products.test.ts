import { describe, expect, it } from 'vitest';

import {
  buildProductReorderSuggestions,
  buildProductsCsv,
  getProductStockUrgency,
  summarizeWorkspaceProducts,
} from './workspace-products';
import type { WorkspaceProduct } from './workspace-data';

const products: WorkspaceProduct[] = [
  product({ id: 'p1', name: 'Printer paper', price: 180, stockQuantity: 0, unit: 'ream' }),
  product({ id: 'p2', name: 'Ink bottle', price: 350, stockQuantity: 3, unit: 'pcs' }),
  product({ id: 'p3', name: 'Service hour', price: 900, stockQuantity: 8, unit: 'hour' }),
  product({ id: 'p4', name: 'Cable', price: 80, stockQuantity: 30, unit: 'pcs' }),
];

describe('workspace product inventory helpers', () => {
  it('summarizes stock, low-stock risk, and inventory value', () => {
    expect(summarizeWorkspaceProducts(products)).toEqual({
      productCount: 4,
      totalStockUnits: 41,
      inventoryValue: 10_650,
      lowStockCount: 2,
      outOfStockCount: 1,
    });
  });

  it('matches the mobile reorder thresholds for stock urgency', () => {
    expect(getProductStockUrgency(0)).toBe('out_of_stock');
    expect(getProductStockUrgency(5)).toBe('reorder_now');
    expect(getProductStockUrgency(8)).toBe('watch');
    expect(getProductStockUrgency(15)).toBe('healthy');
  });

  it('sorts reorder suggestions by urgency before name', () => {
    const suggestions = buildProductReorderSuggestions(products);
    expect(suggestions.map((suggestion) => suggestion.product.name)).toEqual([
      'Printer paper',
      'Ink bottle',
      'Service hour',
      'Cable',
    ]);
    expect(suggestions[0].suggestedReorderQuantity).toBe(10);
    expect(suggestions[1].estimatedReorderCost).toBe(2450);
  });

  it('exports product rows as valid CSV', () => {
    const csv = buildProductsCsv([
      product({ id: 'quote', name: 'Cable, premium', price: 10, stockQuantity: 1, unit: 'pcs' }),
    ]);
    expect(csv).toContain('"Cable, premium"');
    expect(csv.split('\n')).toHaveLength(2);
  });
});

function product(input: Pick<WorkspaceProduct, 'id' | 'name' | 'price' | 'stockQuantity' | 'unit'>): WorkspaceProduct {
  return {
    ...input,
    createdAt: '2026-05-02T00:00:00.000Z',
    lastModified: '2026-05-02T00:00:00.000Z',
    serverRevision: 1,
  };
}
