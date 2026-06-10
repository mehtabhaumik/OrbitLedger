import type {
  OrbitEntityComplianceFlags,
  OrbitEntitySubtype,
  OrbitEntityType,
  OrbitEntityVerificationStatus,
} from '@orbit-ledger/contracts';

export type EntityProfileRevisionSource = 'user' | 'admin' | 'system';
export type EntityProfileRevisionApprovalStatus = 'accepted' | 'pending_review' | 'rejected';

export type EntityProfileRevisionAuditInput = {
  actorUid: string;
  actorEmail?: string | null;
  reason?: string | null;
  source?: EntityProfileRevisionSource;
  approvalStatus?: EntityProfileRevisionApprovalStatus;
  linkedDocumentIds?: string[] | null;
};

export type EntityProfileRevisionSourceData = Partial<{
  businessName: string | null;
  legalName: string | null;
  ownerName: string | null;
  contactPerson: string | null;
  businessType: string | null;
  entityType: OrbitEntityType | string | null;
  entitySubtype: OrbitEntitySubtype | string | null;
  entityVerificationStatus: OrbitEntityVerificationStatus | string | null;
  entityComplianceFlags: Partial<OrbitEntityComplianceFlags> | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  town: string | null;
  postalCode: string | null;
  stateCode: string | null;
  gstin: string | null;
  pan: string | null;
  cin: string | null;
  llpin: string | null;
  taxNumber: string | null;
  registrationNumber: string | null;
  registeredOfficeAddress: string | null;
  principalPlaceOfBusiness: string | null;
  additionalPlacesOfBusiness: string[] | null;
  nonprofitRegistrationNumber: string | null;
  nonprofitRegistrationAuthority: string | null;
  ngoDarpanId: string | null;
  taxExemption12A12ABNumber: string | null;
  taxDeduction80GNumber: string | null;
  fcraRegistrationNumber: string | null;
  csrRegistrationNumber: string | null;
  placeOfSupply: string | null;
}>;

export type EntityProfileRevisionChange = {
  field: keyof EntityProfileRevisionSourceData;
  label: string;
  previousValue: string | boolean | null;
  nextValue: string | boolean | null;
};

export type EntityProfileRevisionRecord = {
  workspace_id: string;
  action: 'profile_updated';
  actor_uid: string;
  actor_email: string | null;
  source: EntityProfileRevisionSource;
  approval_status: EntityProfileRevisionApprovalStatus;
  reason: string;
  changed_fields: string[];
  changes: Array<{
    field: string;
    label: string;
    previous_value: string | boolean | null;
    next_value: string | boolean | null;
  }>;
  previous_snapshot: Record<string, string | boolean | null>;
  next_snapshot: Record<string, string | boolean | null>;
  linked_document_ids: string[];
  server_revision_before: number;
  server_revision_after: number;
  created_at: unknown;
};

const entityProfileRevisionLabels: Record<keyof EntityProfileRevisionSourceData, string> = {
  businessName: 'Business name',
  legalName: 'Legal name',
  ownerName: 'Owner / signatory name',
  contactPerson: 'Contact person',
  businessType: 'Business type',
  entityType: 'Entity type',
  entitySubtype: 'Entity subtype',
  entityVerificationStatus: 'Entity verification status',
  entityComplianceFlags: 'Entity compliance flags',
  phone: 'Phone',
  whatsapp: 'WhatsApp',
  email: 'Email',
  website: 'Website',
  address: 'Business address summary',
  addressLine1: 'Business address line 1',
  addressLine2: 'Business address line 2',
  city: 'Business city',
  town: 'Business town or village',
  postalCode: 'PIN or postcode',
  stateCode: 'State',
  gstin: 'GSTIN',
  pan: 'PAN',
  cin: 'CIN',
  llpin: 'LLPIN',
  taxNumber: 'Tax number',
  registrationNumber: 'Registration number',
  registeredOfficeAddress: 'Legal registered address',
  principalPlaceOfBusiness: 'GST principal place',
  additionalPlacesOfBusiness: 'Additional places of business',
  nonprofitRegistrationNumber: 'Nonprofit registration number',
  nonprofitRegistrationAuthority: 'Nonprofit registration authority',
  ngoDarpanId: 'NGO Darpan ID',
  taxExemption12A12ABNumber: '12A / 12AB number',
  taxDeduction80GNumber: '80G number',
  fcraRegistrationNumber: 'FCRA registration / permission',
  csrRegistrationNumber: 'CSR registration',
  placeOfSupply: 'Place of supply',
};

const entityProfileRevisionFields = Object.keys(entityProfileRevisionLabels) as Array<keyof EntityProfileRevisionSourceData>;

export function buildEntityProfileRevisionRecord(input: {
  workspaceId: string;
  previous: EntityProfileRevisionSourceData;
  next: EntityProfileRevisionSourceData;
  audit: EntityProfileRevisionAuditInput;
  serverRevisionBefore: number;
  serverRevisionAfter: number;
  createdAt: unknown;
}): EntityProfileRevisionRecord | null {
  const previousSnapshot = buildEntityProfileRevisionSnapshot(input.previous);
  const nextSnapshot = buildEntityProfileRevisionSnapshot(input.next);
  const changes = buildEntityProfileRevisionChanges(previousSnapshot, nextSnapshot);

  if (!changes.length) {
    return null;
  }

  return {
    workspace_id: input.workspaceId,
    action: 'profile_updated',
    actor_uid: input.audit.actorUid,
    actor_email: input.audit.actorEmail ?? null,
    source: input.audit.source ?? 'user',
    approval_status: input.audit.approvalStatus ?? 'accepted',
    reason: input.audit.reason?.trim() || 'Entity profile updated',
    changed_fields: changes.map((change) => change.label),
    changes: changes.map((change) => ({
      field: change.field,
      label: change.label,
      previous_value: change.previousValue,
      next_value: change.nextValue,
    })),
    previous_snapshot: previousSnapshot,
    next_snapshot: nextSnapshot,
    linked_document_ids: normalizeDocumentIds(input.audit.linkedDocumentIds),
    server_revision_before: input.serverRevisionBefore,
    server_revision_after: input.serverRevisionAfter,
    created_at: input.createdAt,
  };
}

export function buildEntityProfileRevisionSnapshot(
  source: EntityProfileRevisionSourceData
): Record<string, string | boolean | null> {
  return Object.fromEntries(
    entityProfileRevisionFields.map((field) => [
      field,
      normalizeRevisionValue(source[field]),
    ])
  );
}

function buildEntityProfileRevisionChanges(
  previousSnapshot: Record<string, string | boolean | null>,
  nextSnapshot: Record<string, string | boolean | null>
): EntityProfileRevisionChange[] {
  return entityProfileRevisionFields
    .map((field) => {
      const previousValue = previousSnapshot[field] ?? null;
      const nextValue = nextSnapshot[field] ?? null;
      if (previousValue === nextValue) {
        return null;
      }

      return {
        field,
        label: entityProfileRevisionLabels[field],
        previousValue,
        nextValue,
      };
    })
    .filter((change): change is EntityProfileRevisionChange => Boolean(change));
}

function normalizeRevisionValue(value: unknown): string | boolean | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (Array.isArray(value)) {
    const normalizedList = value
      .map((entry) => normalizeRevisionValue(entry))
      .filter((entry): entry is string | boolean => entry !== null);
    return normalizedList.length ? normalizedList.join('\n') : null;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => typeof entryValue === 'boolean' || typeof entryValue === 'string' || typeof entryValue === 'number')
      .map(([key, entryValue]) => `${key}:${String(entryValue).trim()}`)
      .sort();
    return entries.length ? entries.join('|') : null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join('\n');
  return normalized || null;
}

function normalizeDocumentIds(value: string[] | null | undefined) {
  return (value ?? [])
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 50);
}
