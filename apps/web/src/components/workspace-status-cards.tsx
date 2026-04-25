'use client';

export function WorkspaceStatusCards({
  cards,
}: {
  cards: Array<{
    label: string;
    value: string;
    helper?: string;
    tone?: 'primary' | 'success' | 'warning' | 'premium';
  }>;
}) {
  return (
    <div className="ol-metric-grid">
      {cards.map((card) => (
        <article className="ol-metric-card" data-tone={card.tone ?? 'primary'} key={card.label}>
          <div className="ol-metric-label">{card.label}</div>
          <div className="ol-metric-value ol-amount">{card.value}</div>
          {card.helper ? <div className="ol-metric-helper">{card.helper}</div> : null}
        </article>
      ))}
    </div>
  );
}
