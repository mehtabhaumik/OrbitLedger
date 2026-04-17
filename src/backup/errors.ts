export class BackupValidationError extends Error {
  readonly technicalDetails?: string;

  constructor(message: string, technicalDetails?: string) {
    super(message);
    this.name = 'BackupValidationError';
    this.technicalDetails = technicalDetails;
  }
}

export class BackupRestoreError extends Error {
  readonly technicalDetails?: string;
  readonly currentDataPreserved: boolean;

  constructor(message: string, technicalDetails?: string, currentDataPreserved = true) {
    super(message);
    this.name = 'BackupRestoreError';
    this.technicalDetails = technicalDetails;
    this.currentDataPreserved = currentDataPreserved;
  }
}

export class BackupFileReadError extends Error {
  readonly technicalDetails?: string;

  constructor(message: string, technicalDetails?: string) {
    super(message);
    this.name = 'BackupFileReadError';
    this.technicalDetails = technicalDetails;
  }
}
