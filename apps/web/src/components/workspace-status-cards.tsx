'use client';

import type { CSSProperties } from 'react';

export function WorkspaceStatusCards({
  cards,
}: {
  cards: Array<{ label: string; value: string; helper?: string; tone?: 'primary' | 'success' | 'warning' | 'premium' }>;
}) {
  return (
    <div style={styles.grid}>
      {cards.map((card) => (
        <div key={card.label} style={{ ...styles.card, ...(card.tone ? toneStyles[card.tone] : null) }}>
          <div style={styles.label}>{card.label}</div>
          <div style={styles.value}>{card.value}</div>
          {card.helper ? <div style={styles.helper}>{card.helper}</div> : null}
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
  },
  card: {
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 18,
    display: 'grid',
    gap: 8,
    boxShadow: 'var(--shadow)',
  },
  label: {
    color: 'var(--text-muted)',
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 30,
    fontWeight: 900,
    color: 'var(--text)',
  },
  helper: {
    color: 'var(--text-muted)',
    fontSize: 13,
  },
};

const toneStyles: Record<string, CSSProperties> = {
  primary: {
    borderLeft: '4px solid var(--primary)',
  },
  success: {
    borderLeft: '4px solid var(--success)',
  },
  warning: {
    borderLeft: '4px solid var(--warning)',
  },
  premium: {
    borderLeft: '4px solid var(--premium)',
  },
};
