'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Global command palette (Cmd/Ctrl+K).
 *
 * The app previously had no way to move or act without walking the sidebar into
 * a page and then finding a button. This lets any screen or core action be
 * reached in two keystrokes. It is mounted once inside AppShell so it is present
 * on every workspace page.
 */

type Command = {
  id: string;
  label: string;
  group: 'Go to' | 'Create' | 'Actions';
  /** Extra words matched by the filter but not shown. */
  keywords?: string;
  href: Route;
  hint?: string;
};

const COMMANDS: Command[] = [
  // Navigation - mirrors the sidebar.
  { id: 'nav-home', group: 'Go to', label: 'Home', href: '/dashboard' as Route, keywords: 'dashboard overview' },
  { id: 'nav-customers', group: 'Go to', label: 'Customers', href: '/customers' as Route, keywords: 'clients contacts' },
  { id: 'nav-invoices', group: 'Go to', label: 'Invoices', href: '/invoices' as Route, keywords: 'bills' },
  { id: 'nav-payments', group: 'Go to', label: 'Payments', href: '/payments' as Route, keywords: 'collections received' },
  { id: 'nav-transactions', group: 'Go to', label: 'Transactions', href: '/transactions' as Route, keywords: 'ledger entries' },
  { id: 'nav-products', group: 'Go to', label: 'Products', href: '/products' as Route, keywords: 'inventory items stock' },
  { id: 'nav-documents', group: 'Go to', label: 'Documents', href: '/documents' as Route, keywords: 'files vault' },
  { id: 'nav-templates', group: 'Go to', label: 'Templates', href: '/templates' as Route, keywords: 'invoice layouts' },
  { id: 'nav-reports', group: 'Go to', label: 'Reports', href: '/reports' as Route, keywords: 'analytics summaries' },
  { id: 'nav-market', group: 'Go to', label: 'Market', href: '/market' as Route, keywords: 'growth' },
  { id: 'nav-team', group: 'Go to', label: 'Team', href: '/team' as Route, keywords: 'office members access' },
  { id: 'nav-backup', group: 'Go to', label: 'Backup', href: '/backup' as Route, keywords: 'export restore' },
  { id: 'nav-support', group: 'Go to', label: 'Support', href: '/support' as Route, keywords: 'help' },
  { id: 'nav-settings', group: 'Go to', label: 'Settings', href: '/settings' as Route, keywords: 'preferences profile appearance theme' },
  { id: 'nav-backoffice', group: 'Go to', label: 'Back-office', href: '/backoffice' as Route, keywords: 'operations admin' },

  // Create / actions - route straight to the entry point.
  { id: 'act-new-invoice', group: 'Create', label: 'New invoice', href: '/invoices' as Route, keywords: 'add bill create', hint: 'Invoices' },
  { id: 'act-add-customer', group: 'Create', label: 'Add customer', href: '/customers/new' as Route, keywords: 'new client contact' },
  { id: 'act-record-payment', group: 'Create', label: 'Record a payment', href: '/payments' as Route, keywords: 'collect received manual' },
  { id: 'act-add-product', group: 'Create', label: 'Add product', href: '/products' as Route, keywords: 'inventory item stock' },
  { id: 'act-open-reports', group: 'Actions', label: 'Export a report', href: '/reports' as Route, keywords: 'download summary' },
  { id: 'act-backup-now', group: 'Actions', label: 'Back up this workspace', href: '/backup' as Route, keywords: 'save export' },
];

function matches(command: Command, query: string): boolean {
  if (!query) return true;
  const haystack = `${command.label} ${command.group} ${command.keywords ?? ''}`.toLowerCase();
  // Every whitespace-separated term must appear, so "new inv" narrows sensibly.
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => COMMANDS.filter((command) => matches(command, query)), [query]);

  // Global open shortcut. Cmd+K on mac, Ctrl+K elsewhere; also '/' when not
  // already typing in a field.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      const target = event.target as HTMLElement | null;
      const typing =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      const isSlash = event.key === '/' && !typing;

      if (isShortcut || isSlash) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Reset and focus each time it opens.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // Focus after paint so the dialog is in the DOM.
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [open]);

  // Keep the active row in view.
  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(results.length - 1, 0)));
  }, [results.length]);

  const run = useCallback(
    (command: Command | undefined) => {
      if (!command) return;
      setOpen(false);
      router.push(command.href);
    },
    [router]
  );

  function onListKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % Math.max(results.length, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + results.length) % Math.max(results.length, 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(results[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  }

  if (!open) {
    return null;
  }

  // Group results while preserving overall order for the flat active index.
  let flatIndex = -1;
  const groups: Array<{ name: Command['group']; items: Array<{ command: Command; index: number }> }> = [];
  for (const command of results) {
    flatIndex += 1;
    const bucket = groups.find((group) => group.name === command.group);
    const entry = { command, index: flatIndex };
    if (bucket) bucket.items.push(entry);
    else groups.push({ name: command.group, items: [entry] });
  }

  return (
    <div className="ol-cmdk-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
      <div
        className="ol-cmdk"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={onListKeyDown}
      >
        <div className="ol-cmdk-search">
          <svg className="ol-cmdk-search-icon" viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M9 3a6 6 0 1 0 3.7 10.7l3.3 3.3 1.4-1.4-3.3-3.3A6 6 0 0 0 9 3Zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"
              fill="currentColor"
            />
          </svg>
          <input
            ref={inputRef}
            className="ol-cmdk-input"
            placeholder="Search or jump to…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search commands"
            aria-controls="ol-cmdk-list"
            aria-activedescendant={results[activeIndex] ? `ol-cmdk-${results[activeIndex].id}` : undefined}
          />
          <kbd className="ol-cmdk-esc">Esc</kbd>
        </div>

        <div className="ol-cmdk-list" id="ol-cmdk-list" ref={listRef} role="listbox">
          {results.length === 0 ? (
            <p className="ol-cmdk-empty">No matches for “{query}”.</p>
          ) : (
            groups.map((group) => (
              <div className="ol-cmdk-group" key={group.name}>
                <div className="ol-cmdk-group-label">{group.name}</div>
                {group.items.map(({ command, index }) => (
                  <button
                    key={command.id}
                    id={`ol-cmdk-${command.id}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`ol-cmdk-item${index === activeIndex ? ' is-active' : ''}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => run(command)}
                  >
                    <span className="ol-cmdk-item-label">{command.label}</span>
                    {command.hint ? <span className="ol-cmdk-item-hint">{command.hint}</span> : null}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="ol-cmdk-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> to navigate</span>
          <span><kbd>↵</kbd> to open</span>
        </div>
      </div>
    </div>
  );
}
