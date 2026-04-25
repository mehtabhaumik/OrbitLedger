export class DatabaseError extends Error {
  constructor(
    message: string,
    readonly operation: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export function throwDatabaseError(operation: string, error: unknown): never {
  console.error(`[database] ${operation} failed`, error);
  throw new DatabaseError(`Database operation failed: ${operation}`, operation, error);
}
