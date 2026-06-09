'use client';

import { useEffect, useMemo, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import {
  listWorkspaceProducts,
  saveWorkspaceProduct,
  type WorkspaceProduct,
} from '@/lib/workspace-data';
import {
  buildProductReorderSuggestions,
  buildProductsCsv,
  productStatusTone,
  summarizeWorkspaceProducts,
} from '@/lib/workspace-products';
import { downloadTextFile, makeExportFileName } from '@/lib/workspace-power';
import { formatPrintCurrency, openOrbitPrintDocument, printPreparedByFromUser } from '@/lib/print-system';
import { getWorkspaceExportName } from '@/lib/workspace-profile-view';
import { useAuth } from '@/providers/auth-provider';
import { useOfficeAccess } from '@/providers/office-access-provider';
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';

type ProductFormState = {
  id: string | null;
  name: string;
  price: string;
  stockQuantity: string;
  unit: string;
};

const emptyForm: ProductFormState = {
  id: null,
  name: '',
  price: '',
  stockQuantity: '0',
  unit: 'pcs',
};

export default function ProductsPage() {
  const { activeWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { showToast } = useToast();
  const officeAccess = useOfficeAccess();
  const [products, setProducts] = useState<WorkspaceProduct[]>([]);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }
    void loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.workspaceId]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return products;
    }
    return products.filter((product) =>
      [product.name, product.unit].some((value) => value.toLowerCase().includes(query))
    );
  }, [products, search]);
  const summary = useMemo(() => summarizeWorkspaceProducts(filteredProducts), [filteredProducts]);
  const suggestions = useMemo(() => buildProductReorderSuggestions(filteredProducts), [filteredProducts]);
  const actionableSuggestions = suggestions.filter((suggestion) => suggestion.urgency !== 'healthy');
  const currency = activeWorkspace?.currency ?? 'INR';

  async function loadProducts() {
    if (!activeWorkspace) {
      return;
    }
    setIsLoading(true);
    try {
      setProducts(await listWorkspaceProducts(activeWorkspace.workspaceId));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Products could not load.', 'danger');
    } finally {
      setIsLoading(false);
    }
  }

  async function saveProduct() {
    if (!activeWorkspace) {
      return;
    }
    if (!officeAccess.can('manage_products_inventory')) {
      showToast(officeAccess.getLockedMessage('manage_products_inventory'), 'info');
      return;
    }
    const price = parseAmount(form.price);
    const stockQuantity = parseQuantity(form.stockQuantity);
    if (!form.name.trim() || price === null || stockQuantity === null || !form.unit.trim()) {
      showToast('Add product name, price, stock, and unit before saving.', 'danger');
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveWorkspaceProduct(
        activeWorkspace.workspaceId,
        {
          name: form.name,
          price,
          stockQuantity,
          unit: form.unit,
        },
        form.id ?? undefined
      );
      setProducts((current) => [saved, ...current.filter((product) => product.id !== saved.id)].sort(sortProducts));
      setForm(emptyForm);
      showToast(form.id ? 'Product updated.' : 'Product saved.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Product could not be saved.', 'danger');
    } finally {
      setIsSaving(false);
    }
  }

  function editProduct(product: WorkspaceProduct) {
    setForm({
      id: product.id,
      name: product.name,
      price: String(product.price),
      stockQuantity: String(product.stockQuantity),
      unit: product.unit,
    });
  }

  function exportProducts() {
    if (!activeWorkspace) {
      return;
    }
    if (!officeAccess.can('export_reports')) {
      showToast(officeAccess.getLockedMessage('export_reports'), 'info');
      return;
    }
    downloadTextFile(
      makeExportFileName([getWorkspaceExportName(activeWorkspace), 'products']),
      buildProductsCsv(filteredProducts)
    );
  }

  function printInventory() {
    if (!activeWorkspace) {
      return;
    }
    if (!officeAccess.can('export_reports')) {
      showToast(officeAccess.getLockedMessage('export_reports'), 'info');
      return;
    }

    try {
      openOrbitPrintDocument({
        title: 'Product and Inventory List',
        subtitle: `${filteredProducts.length} product${filteredProducts.length === 1 ? '' : 's'} in the current view.`,
        workspace: activeWorkspace,
        preparedBy: printPreparedByFromUser(user),
        classification: 'Inventory record',
        sections: [
          {
            type: 'summary',
            title: 'Inventory summary',
            metrics: [
              { label: 'Products', value: summary.productCount },
              { label: 'Low stock', value: summary.lowStockCount },
              { label: 'Stock units', value: formatQuantity(summary.totalStockUnits) },
              { label: 'Inventory value', value: formatPrintCurrency(summary.inventoryValue, currency, activeWorkspace.countryCode) },
            ],
          },
          {
            type: 'table',
            title: 'Stock review',
            columns: [
              { key: 'product', label: 'Product' },
              { key: 'stock', label: 'Stock', align: 'right' },
              { key: 'price', label: 'Price', align: 'right' },
              { key: 'status', label: 'Status' },
              { key: 'suggested', label: 'Suggested reorder', align: 'right' },
            ],
            rows: filteredProducts.map((product) => {
              const suggestion = suggestions.find((item) => item.product.id === product.id);
              return {
                product: product.name,
                stock: `${formatQuantity(product.stockQuantity)} ${product.unit}`,
                price: formatPrintCurrency(product.price, currency, activeWorkspace.countryCode),
                status: suggestion?.urgencyLabel ?? 'Healthy',
                suggested: suggestion ? `${formatQuantity(suggestion.suggestedReorderQuantity)} ${product.unit}` : '-',
              };
            }),
            emptyText: 'No products match this view.',
          },
        ],
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Print view could not open.', 'danger');
    }
  }

  return (
    <AppShell title="Products" subtitle="Track stock, invoice-ready items, and reorder risk from web.">
      <section className="ol-metric-grid">
        <Metric label="Products" value={String(summary.productCount)} helper="Invoice-ready product records." tone="primary" />
        <Metric label="Low stock" value={String(summary.lowStockCount)} helper="At or below the alert level." tone="warning" />
        <Metric label="Stock units" value={formatQuantity(summary.totalStockUnits)} helper="Current quantity across products." tone="success" />
        <Metric label="Inventory value" value={formatCurrency(summary.inventoryValue, currency)} helper="Stock multiplied by selling price." tone="premium" />
      </section>

      <section className="ol-panel">
          <div className="ol-panel-header">
            <div>
              <div className="ol-panel-title">Inventory review</div>
              <p className="ol-panel-copy">Low-stock products appear first so the owner knows what to restock.</p>
            </div>
            <span className="ol-chip ol-chip--warning">{actionableSuggestions.length} to review</span>
          </div>
          <div className="ol-list">
            {(actionableSuggestions.length ? actionableSuggestions : suggestions.slice(0, 4)).map((suggestion) => (
              <div className="ol-list-item" key={suggestion.product.id}>
                <div className="ol-list-icon">{suggestion.product.name.charAt(0).toUpperCase()}</div>
                <div className="ol-list-copy">
                  <div className="ol-list-title">
                    {suggestion.product.name} · {suggestion.urgencyLabel}
                  </div>
                  <div className="ol-list-text">
                    {suggestion.reason} Suggested reorder: {formatQuantity(suggestion.suggestedReorderQuantity)} {suggestion.product.unit}.
                  </div>
                </div>
              </div>
            ))}
            {!suggestions.length ? <div className="ol-empty">Add products to see stock review here.</div> : null}
          </div>
      </section>

      <section className="ol-table">
          <div className="ol-table-tools">
            <label className="ol-field">
              <span className="ol-field-label">Search products</span>
              <input className="ol-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or unit" />
            </label>
            <div className="ol-table-actions">
              <button className="ol-button-secondary" type="button" onClick={loadProducts} disabled={isLoading}>
                Refresh
              </button>
              <button className="ol-button-secondary" type="button" onClick={exportProducts} disabled={!filteredProducts.length || !officeAccess.can('export_reports')}>
                Export products
              </button>
              <button className="ol-button-secondary" type="button" onClick={printInventory} disabled={!filteredProducts.length || !officeAccess.can('export_reports')}>
                Print inventory
              </button>
            </div>
          </div>
          <div className="ol-table-summary">
            {isLoading ? 'Loading products...' : `${filteredProducts.length} product${filteredProducts.length === 1 ? '' : 's'} shown.`}
          </div>
          <div className="ol-table-head" style={{ gridTemplateColumns: '1.2fr 0.7fr 0.7fr 0.8fr 0.6fr' }}>
            <span>Product</span>
            <span>Stock</span>
            <span>Price</span>
            <span>Status</span>
            <span>Action</span>
          </div>
          {filteredProducts.map((product) => {
            const suggestion = suggestions.find((item) => item.product.id === product.id);
            const tone = productStatusTone(suggestion?.urgency ?? 'healthy');
            return (
              <div className="ol-table-row" style={{ gridTemplateColumns: '1.2fr 0.7fr 0.7fr 0.8fr 0.6fr' }} key={product.id}>
                <span>
                  <strong>{product.name}</strong>
                  <br />
                  <span className="ol-muted" style={{ fontSize: 13 }}>
                    Unit: {product.unit}
                  </span>
                </span>
                <span>{formatQuantity(product.stockQuantity)} {product.unit}</span>
                <span>{formatCurrency(product.price, currency)}</span>
                <span>
                  <span className={`ol-chip ol-chip--${tone}`}>{suggestion?.urgencyLabel ?? 'Healthy'}</span>
                </span>
                <span>
                  <button className="ol-button-secondary" type="button" onClick={() => editProduct(product)}>
                    Edit
                  </button>
                </span>
              </div>
            );
          })}
          {!filteredProducts.length ? <div className="ol-empty">No products match this view.</div> : null}
      </section>

      <section className="ol-panel">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">{form.id ? 'Edit product' : 'Add product'}</div>
            <p className="ol-panel-copy">Use the same fields as mobile so product selection stays consistent in invoices.</p>
          </div>
          <span className="ol-chip ol-chip--success">Inventory ready</span>
        </div>
        <div className="ol-form-band-grid">
          <label className="ol-field">
            <span className="ol-field-label ol-field-label--with-meta">
              <span className="ol-field-label-text">
                Product name
                <span className="ol-required-badge">Required</span>
              </span>
              <ProductFieldHelp help="Keep it short and recognizable so invoice line-item selection stays quick." label="Product name" />
            </span>
            <input
              aria-required="true"
              className="ol-input"
              required
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Printer paper"
            />
          </label>
          <label className="ol-field">
            <span className="ol-field-label ol-field-label--with-meta">
              <span className="ol-field-label-text">
                Price
                <span className="ol-required-badge">Required</span>
              </span>
              <ProductFieldHelp help="Default selling price used when this product is added to an invoice. You can still adjust invoice line items later." label="Price" />
            </span>
            <input
              aria-required="true"
              className="ol-input ol-amount"
              inputMode="decimal"
              required
              value={form.price}
              onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
              placeholder="0.00"
            />
          </label>
          <label className="ol-field">
            <span className="ol-field-label ol-field-label--with-meta">
              <span className="ol-field-label-text">
                Stock
                <span className="ol-required-badge">Required</span>
              </span>
              <ProductFieldHelp help="Current quantity on hand. This helps Orbit Ledger show inventory value and low-stock review." label="Stock" />
            </span>
            <input
              aria-required="true"
              className="ol-input ol-amount"
              inputMode="decimal"
              required
              value={form.stockQuantity}
              onChange={(event) => setForm((current) => ({ ...current, stockQuantity: event.target.value }))}
              placeholder="0"
            />
          </label>
          <label className="ol-field">
            <span className="ol-field-label ol-field-label--with-meta">
              <span className="ol-field-label-text">
                Unit
                <span className="ol-required-badge">Required</span>
              </span>
              <ProductFieldHelp help="The measurement shown on invoices and stock reports, such as pcs, kg, hour, box, or service." label="Unit" />
            </span>
            <input
              aria-required="true"
              className="ol-input"
              required
              value={form.unit}
              onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}
              placeholder="pcs, kg, hour"
            />
          </label>
        </div>
        <div className="ol-actions" style={{ marginTop: 16 }}>
          <button className="ol-button" type="button" onClick={saveProduct} disabled={isSaving || !officeAccess.can('manage_products_inventory')}>
            {form.id ? 'Update product' : 'Save product'}
          </button>
          <button className="ol-button-ghost" type="button" onClick={() => setForm(emptyForm)} disabled={!form.id && !form.name}>
            Clear form
          </button>
        </div>
      </section>
    </AppShell>
  );
}

function ProductFieldHelp({ help, label }: { help: string; label: string }) {
  return (
    <details className="ol-field-info">
      <summary aria-label={`What is ${label}?`}>?</summary>
      <span>{help}</span>
    </details>
  );
}

function Metric({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: 'primary' | 'warning' | 'success' | 'premium';
}) {
  return (
    <article className="ol-metric-card" data-tone={tone}>
      <div className="ol-metric-label">{label}</div>
      <div className="ol-metric-value">{value}</div>
      <div className="ol-metric-helper">{helper}</div>
    </article>
  );
}

function parseAmount(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}

function parseQuantity(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 1000) / 1000 : null;
}

function sortProducts(left: WorkspaceProduct, right: WorkspaceProduct) {
  return left.name.localeCompare(right.name);
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, '');
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
