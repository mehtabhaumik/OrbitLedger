export type CustomerHealthRank =
  | 'excellent'
  | 'reliable'
  | 'watch_closely'
  | 'needs_follow_up'
  | 'high_risk';

export type CustomerHealthInput = {
  balance: number;
  totalCredit?: number | null;
  totalPayment?: number | null;
  paymentCount?: number | null;
  daysOutstanding?: number | null;
  lastPaymentAt?: string | null;
  latestActivityAt?: string | null;
};

export type CustomerHealthScore = {
  rank: CustomerHealthRank;
  label: string;
  score: number;
  helper: string;
  tone: 'success' | 'primary' | 'warning' | 'danger';
};

export function buildCustomerHealthScore(input: CustomerHealthInput): CustomerHealthScore {
  const balance = Number.isFinite(input.balance) ? input.balance : 0;
  const totalCredit = Math.max(Number(input.totalCredit ?? 0), 0);
  const totalPayment = Math.max(Number(input.totalPayment ?? 0), 0);
  const paymentCount = Math.max(Number(input.paymentCount ?? 0), 0);
  const daysOutstanding = input.daysOutstanding ?? inferDaysSince(input.latestActivityAt);
  const collectionRatio = totalCredit > 0 ? totalPayment / totalCredit : balance <= 0 ? 1 : 0;

  let score = 78;
  if (balance <= 0) {
    score += 12;
  }
  if (paymentCount > 0) {
    score += 6;
  }
  if (collectionRatio >= 0.9) {
    score += 8;
  } else if (collectionRatio < 0.35 && balance > 0) {
    score -= 16;
  }
  if (balance > 0) {
    score -= Math.min(28, Math.max(0, balance / Math.max(totalCredit || balance, 1)) * 18);
  }
  if ((daysOutstanding ?? 0) >= 30) {
    score -= 26;
  } else if ((daysOutstanding ?? 0) >= 14) {
    score -= 16;
  } else if ((daysOutstanding ?? 0) >= 7) {
    score -= 8;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  if (score >= 88) {
    return {
      rank: 'excellent',
      label: 'Excellent',
      score,
      helper: 'Healthy payment pattern and no urgent collection risk.',
      tone: 'success',
    };
  }
  if (score >= 74) {
    return {
      rank: 'reliable',
      label: 'Reliable',
      score,
      helper: 'Generally steady. Keep normal follow-up rhythm.',
      tone: 'primary',
    };
  }
  if (score >= 58) {
    return {
      rank: 'watch_closely',
      label: 'Watch closely',
      score,
      helper: 'Some dues or slower payment signs need attention.',
      tone: 'warning',
    };
  }
  if (score >= 40) {
    return {
      rank: 'needs_follow_up',
      label: 'Needs follow-up',
      score,
      helper: 'Follow up before extending more credit.',
      tone: 'warning',
    };
  }
  return {
    rank: 'high_risk',
    label: 'High risk',
    score,
    helper: 'Collection risk is high. Review before adding more credit.',
    tone: 'danger',
  };
}

function inferDaysSince(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / (24 * 60 * 60 * 1000)));
}
