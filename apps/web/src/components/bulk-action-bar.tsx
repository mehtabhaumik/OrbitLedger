'use client';

import type { ReactNode } from 'react';

/**
 * A floating action bar that appears when one or more list rows are selected.
 *
 * Reusable across the invoice, customer, transaction and payment lists so bulk
 * work (export, reminders, status changes) is one action on a selection instead
 * of repeating a per-row flow. The bar owns only presentation and the selection
 * count/clear affordance; each list passes its own action buttons as children,
 * wired to that list's existing single-row logic.
 */
type BulkActionBarProps = {
  count: number;
  /** Noun for the selected rows, e.g. "invoice". Pluralised automatically. */
  noun: string;
  onClear(): void;
  children: ReactNode;
};

export function BulkActionBar({ count, noun, onClear, children }: BulkActionBarProps) {
  if (count <= 0) {
    return null;
  }

  return (
    <div className="ol-bulkbar" role="region" aria-label={`${count} ${noun}${count === 1 ? '' : 's'} selected`}>
      <div className="ol-bulkbar-count">
        <strong>{count}</strong>
        <span>
          {noun}
          {count === 1 ? '' : 's'} selected
        </span>
      </div>
      <div className="ol-bulkbar-actions">{children}</div>
      <button type="button" className="ol-bulkbar-clear" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
