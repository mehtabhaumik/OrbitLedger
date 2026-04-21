export type PerformanceOperationId =
  | 'app_startup_readiness'
  | 'sqlite_initialization'
  | 'business_profile_load'
  | 'dashboard_summary_load'
  | 'customer_search'
  | 'customer_ledger_load'
  | 'transaction_save'
  | 'invoice_save'
  | 'statement_pdf_generation'
  | 'invoice_pdf_generation'
  | 'backup_export'
  | 'restore_validation'
  | 'restore_apply';

export type PerformanceMeasurementStatus = 'success' | 'failure';

export type PerformanceMeasurement = {
  id: string;
  operationId: PerformanceOperationId;
  label: string;
  durationMs: number;
  status: PerformanceMeasurementStatus;
  startedAt: string;
  completedAt: string;
  metadata?: Record<string, string | number | boolean | null>;
  errorMessage?: string;
};

export type PerformanceTarget = {
  operationId: PerformanceOperationId;
  label: string;
  targetMs: number;
  cautionMs: number;
  description: string;
};

export type PerformanceOperationSummary = {
  operationId: PerformanceOperationId;
  label: string;
  targetMs: number;
  cautionMs: number;
  sampleCount: number;
  latestMs: number | null;
  averageMs: number | null;
  slowestMs: number | null;
  failureCount: number;
  status: 'not_measured' | 'good' | 'caution' | 'slow' | 'failed';
};

export type PerformanceReport = {
  appName: 'Orbit Ledger';
  generatedAt: string;
  mode: 'development';
  targets: PerformanceTarget[];
  summaries: PerformanceOperationSummary[];
  measurements: PerformanceMeasurement[];
};

const MAX_MEASUREMENTS = 250;

export const PERFORMANCE_TARGETS: PerformanceTarget[] = [
  {
    operationId: 'app_startup_readiness',
    label: 'App startup readiness',
    targetMs: 2500,
    cautionMs: 4500,
    description: 'Time until the first app route can be selected after local services are prepared.',
  },
  {
    operationId: 'sqlite_initialization',
    label: 'SQLite initialization',
    targetMs: 700,
    cautionMs: 1500,
    description: 'Opening the local database and ensuring schema/defaults are ready.',
  },
  {
    operationId: 'business_profile_load',
    label: 'Business profile load',
    targetMs: 250,
    cautionMs: 600,
    description: 'Loading the local business profile used by onboarding/dashboard.',
  },
  {
    operationId: 'dashboard_summary_load',
    label: 'Dashboard summary load',
    targetMs: 500,
    cautionMs: 1200,
    description: 'Calculating primary dashboard totals from local SQLite.',
  },
  {
    operationId: 'customer_search',
    label: 'Customer search',
    targetMs: 120,
    cautionMs: 300,
    description: 'Returning local customer search results while typing.',
  },
  {
    operationId: 'customer_ledger_load',
    label: 'Customer ledger load',
    targetMs: 500,
    cautionMs: 1200,
    description: 'Opening a customer ledger and calculating balance.',
  },
  {
    operationId: 'transaction_save',
    label: 'Transaction save',
    targetMs: 250,
    cautionMs: 700,
    description: 'Saving or editing a credit/payment entry.',
  },
  {
    operationId: 'invoice_save',
    label: 'Invoice save',
    targetMs: 700,
    cautionMs: 1500,
    description: 'Saving or editing an invoice and applying stock changes.',
  },
  {
    operationId: 'statement_pdf_generation',
    label: 'Statement PDF generation',
    targetMs: 2500,
    cautionMs: 6000,
    description: 'Generating a customer statement PDF locally.',
  },
  {
    operationId: 'invoice_pdf_generation',
    label: 'Invoice PDF generation',
    targetMs: 2200,
    cautionMs: 5500,
    description: 'Generating an invoice PDF locally.',
  },
  {
    operationId: 'backup_export',
    label: 'Backup export',
    targetMs: 2500,
    cautionMs: 6500,
    description: 'Extracting, validating, serializing, and saving a full local backup.',
  },
  {
    operationId: 'restore_validation',
    label: 'Restore validation',
    targetMs: 900,
    cautionMs: 2200,
    description: 'Parsing and validating a backup before restore confirmation.',
  },
  {
    operationId: 'restore_apply',
    label: 'Restore apply',
    targetMs: 3500,
    cautionMs: 9000,
    description: 'Applying a full replace restore transaction safely.',
  },
];

const measurements: PerformanceMeasurement[] = [];

export function isPerformanceInstrumentationEnabled(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

export async function measurePerformance<T>(
  operationId: PerformanceOperationId,
  label: string,
  operation: () => Promise<T>,
  metadata?: PerformanceMeasurement['metadata']
): Promise<T> {
  if (!isPerformanceInstrumentationEnabled()) {
    return operation();
  }

  const startedAt = new Date();
  const started = nowMs();

  try {
    const result = await operation();
    recordPerformanceMeasurement({
      operationId,
      label,
      durationMs: nowMs() - started,
      status: 'success',
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      metadata,
    });
    return result;
  } catch (error) {
    recordPerformanceMeasurement({
      operationId,
      label,
      durationMs: nowMs() - started,
      status: 'failure',
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      metadata,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export function measurePerformanceSync<T>(
  operationId: PerformanceOperationId,
  label: string,
  operation: () => T,
  metadata?: PerformanceMeasurement['metadata']
): T {
  if (!isPerformanceInstrumentationEnabled()) {
    return operation();
  }

  const startedAt = new Date();
  const started = nowMs();

  try {
    const result = operation();
    recordPerformanceMeasurement({
      operationId,
      label,
      durationMs: nowMs() - started,
      status: 'success',
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      metadata,
    });
    return result;
  } catch (error) {
    recordPerformanceMeasurement({
      operationId,
      label,
      durationMs: nowMs() - started,
      status: 'failure',
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      metadata,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export function recordPerformanceMeasurement(
  input: Omit<PerformanceMeasurement, 'id'>
): PerformanceMeasurement | null {
  if (!isPerformanceInstrumentationEnabled()) {
    return null;
  }

  const measurement: PerformanceMeasurement = {
    ...input,
    id: `perf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    durationMs: Math.max(0, Math.round(input.durationMs)),
  };

  measurements.unshift(measurement);
  if (measurements.length > MAX_MEASUREMENTS) {
    measurements.length = MAX_MEASUREMENTS;
  }

  const target = PERFORMANCE_TARGETS.find((item) => item.operationId === measurement.operationId);
  const targetText = target ? ` target=${target.targetMs}ms` : '';
  const errorText = measurement.errorMessage ? ` error=${measurement.errorMessage}` : '';
  console.info(
    `[performance] ${measurement.operationId} ${measurement.status} ${measurement.durationMs}ms${targetText}${errorText}`
  );

  return measurement;
}

export function clearPerformanceMeasurements(): void {
  measurements.length = 0;
}

export function getPerformanceMeasurements(): PerformanceMeasurement[] {
  return [...measurements];
}

export function buildPerformanceReport(): PerformanceReport {
  const currentMeasurements = getPerformanceMeasurements();
  return {
    appName: 'Orbit Ledger',
    generatedAt: new Date().toISOString(),
    mode: 'development',
    targets: PERFORMANCE_TARGETS,
    summaries: PERFORMANCE_TARGETS.map((target) =>
      summarizeOperation(target, currentMeasurements.filter((item) => item.operationId === target.operationId))
    ),
    measurements: currentMeasurements,
  };
}

export function serializePerformanceReport(report = buildPerformanceReport()): string {
  return JSON.stringify(report, null, 2);
}

function summarizeOperation(
  target: PerformanceTarget,
  operationMeasurements: PerformanceMeasurement[]
): PerformanceOperationSummary {
  const successful = operationMeasurements.filter((item) => item.status === 'success');
  const latest = successful[0]?.durationMs ?? null;
  const average =
    successful.length > 0
      ? Math.round(successful.reduce((sum, item) => sum + item.durationMs, 0) / successful.length)
      : null;
  const slowest =
    successful.length > 0 ? Math.max(...successful.map((item) => item.durationMs)) : null;
  const failureCount = operationMeasurements.filter((item) => item.status === 'failure').length;

  return {
    operationId: target.operationId,
    label: target.label,
    targetMs: target.targetMs,
    cautionMs: target.cautionMs,
    sampleCount: operationMeasurements.length,
    latestMs: latest,
    averageMs: average,
    slowestMs: slowest,
    failureCount,
    status: summarizeStatus(latest, failureCount, target),
  };
}

function summarizeStatus(
  latestMs: number | null,
  failureCount: number,
  target: PerformanceTarget
): PerformanceOperationSummary['status'] {
  if (failureCount > 0 && latestMs === null) {
    return 'failed';
  }
  if (latestMs === null) {
    return 'not_measured';
  }
  if (latestMs <= target.targetMs) {
    return 'good';
  }
  if (latestMs <= target.cautionMs) {
    return 'caution';
  }
  return 'slow';
}

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
}

