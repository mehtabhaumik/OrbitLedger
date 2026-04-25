export function createEntityId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function cleanText(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

export function requiredText(value: string): string {
  return value.trim();
}

export function assertPositiveAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be greater than zero.');
  }
}

export function escapeLikeQuery(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export function localDayBounds(date = new Date()): { startIso: string; endIso: string } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export function toDateOnlyIso(value = new Date()): string {
  const date = new Date(value);
  date.setHours(12, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}
