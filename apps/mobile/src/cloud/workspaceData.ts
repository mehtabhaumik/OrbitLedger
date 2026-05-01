import type { OrbitSyncEntityName, OrbitWorkspaceDataState } from '@orbit-ledger/contracts';
import { getSyncStrategy } from '@orbit-ledger/sync';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  runTransaction,
  setDoc,
} from 'firebase/firestore';

import { getFirebaseApp } from './firebase';

type SupportedWorkspaceEntity =
  | 'customers'
  | 'transactions'
  | 'products'
  | 'invoices'
  | 'invoice_items'
  | 'payment_allocations';

export type RemoteWorkspaceRecord<TPayload extends Record<string, unknown>> = TPayload & {
  id: string;
  last_modified: string;
  server_revision: number;
  sync_status?: string;
};

export type RemoteWorkspaceDataset = {
  customers: Array<
    RemoteWorkspaceRecord<{
      name: string;
      phone: string | null;
      address: string | null;
      notes: string | null;
      opening_balance: number;
      is_archived: boolean;
      created_at: string;
      updated_at: string;
    }>
  >;
  transactions: Array<
    RemoteWorkspaceRecord<{
      customer_id: string;
      type: 'credit' | 'payment';
      amount: number;
      note: string | null;
      payment_mode?: string | null;
      payment_details_json?: string | null;
      effective_date: string;
      created_at: string;
    }>
  >;
  products: Array<
    RemoteWorkspaceRecord<{
      name: string;
      price: number;
      stock_quantity: number;
      unit: string;
      created_at: string;
    }>
  >;
  invoices: Array<
    RemoteWorkspaceRecord<{
      customer_id: string | null;
      invoice_number: string;
      issue_date: string;
      due_date: string | null;
      subtotal: number;
      tax_amount: number;
      total_amount: number;
      paid_amount?: number;
      status: string;
      document_state?: string;
      payment_status?: string;
      version_number?: number;
      latest_version_id?: string | null;
      latest_snapshot_hash?: string | null;
      notes: string | null;
      created_at: string;
    }>
  >;
  invoice_items: Array<
    RemoteWorkspaceRecord<{
      invoice_id: string;
      product_id: string | null;
      name: string;
      description: string | null;
      quantity: number;
      price: number;
      tax_rate: number;
      total: number;
    }>
  >;
  payment_allocations: Array<
    RemoteWorkspaceRecord<{
      transaction_id: string;
      invoice_id: string;
      customer_id: string;
      amount: number;
      created_at: string;
    }>
  >;
};

export type RemoteWorkspaceUpsertInput = {
  workspaceId: string;
  entity: OrbitSyncEntityName;
  recordId: string;
  expectedServerRevision: number;
  payload: Record<string, unknown>;
};

export type RemoteWorkspaceUpsertResult = {
  recordId: string;
  lastModified: string;
  serverRevision: number;
};

const ENTITY_TO_COLLECTION: Record<SupportedWorkspaceEntity, string> = {
  customers: 'customers',
  transactions: 'transactions',
  products: 'products',
  invoices: 'invoices',
  invoice_items: 'invoice_items',
  payment_allocations: 'payment_allocations',
};

function getWorkspaceRef(workspaceId: string) {
  return doc(getFirestore(getFirebaseApp()), 'workspaces', workspaceId);
}

function getEntityCollection(workspaceId: string, entity: SupportedWorkspaceEntity) {
  return collection(
    getFirestore(getFirebaseApp()),
    'workspaces',
    workspaceId,
    ENTITY_TO_COLLECTION[entity]
  );
}

function assertSupportedEntity(entity: OrbitSyncEntityName): SupportedWorkspaceEntity {
  if (
    entity === 'customers' ||
    entity === 'transactions' ||
    entity === 'products' ||
    entity === 'invoices' ||
    entity === 'invoice_items' ||
    entity === 'payment_allocations'
  ) {
    return entity;
  }

  throw new Error(`Unsupported workspace sync entity: ${entity}`);
}

export async function getWorkspaceDataState(
  workspaceId: string
): Promise<OrbitWorkspaceDataState | null> {
  const snapshot = await getDoc(getWorkspaceRef(workspaceId));
  if (!snapshot.exists()) {
    return null;
  }

  const value = snapshot.data()?.data_state;
  return value === 'full_dataset' ? 'full_dataset' : 'profile_only';
}

export async function markWorkspaceDataState(
  workspaceId: string,
  dataState: OrbitWorkspaceDataState
): Promise<void> {
  await setDoc(
    getWorkspaceRef(workspaceId),
    {
      data_state: dataState,
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function upsertWorkspaceEntity(
  input: RemoteWorkspaceUpsertInput
): Promise<RemoteWorkspaceUpsertResult> {
  const entity = assertSupportedEntity(input.entity);
  const firestore = getFirestore(getFirebaseApp());
  const recordRef = doc(getEntityCollection(input.workspaceId, entity), input.recordId);

  let result: RemoteWorkspaceUpsertResult | null = null;
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(recordRef);
    const currentData = snapshot.data() as { server_revision?: number; created_at?: string } | undefined;
    const currentRevision =
      typeof currentData?.server_revision === 'number' && Number.isFinite(currentData.server_revision)
        ? currentData.server_revision
        : 0;
    const lastModified = String(input.payload.last_modified ?? new Date().toISOString());
    const strategy = getSyncStrategy(input.entity);

    if (
      strategy === 'revision_protected' &&
      snapshot.exists() &&
      currentRevision !== input.expectedServerRevision
    ) {
      throw new Error('Remote record changed since the last local sync.');
    }

    const serverRevision = snapshot.exists() ? currentRevision + 1 : 1;
    transaction.set(
      recordRef,
      {
        ...input.payload,
        created_at: currentData?.created_at ?? input.payload.created_at ?? lastModified,
        updated_at: input.payload.updated_at ?? lastModified,
        last_modified: lastModified,
        sync_status: 'synced',
        server_revision: serverRevision,
      },
      { merge: true }
    );

    result = {
      recordId: input.recordId,
      lastModified,
      serverRevision,
    };
  });

  if (!result) {
    throw new Error(`Workspace entity upsert did not return a result for ${input.entity}.`);
  }

  return result;
}

export async function fetchWorkspaceDataset(workspaceId: string): Promise<RemoteWorkspaceDataset> {
  const [customers, transactions, products, invoices, invoiceItems, paymentAllocations] = await Promise.all([
    loadCollection(workspaceId, 'customers'),
    loadCollection(workspaceId, 'transactions'),
    loadCollection(workspaceId, 'products'),
    loadCollection(workspaceId, 'invoices'),
    loadCollection(workspaceId, 'invoice_items'),
    loadCollection(workspaceId, 'payment_allocations'),
  ]);

  return {
    customers,
    transactions,
    products,
    invoices,
    invoice_items: invoiceItems,
    payment_allocations: paymentAllocations,
  } as RemoteWorkspaceDataset;
}

async function loadCollection(
  workspaceId: string,
  entity: SupportedWorkspaceEntity
): Promise<Array<RemoteWorkspaceRecord<Record<string, unknown>>>> {
  const snapshot = await getDocs(getEntityCollection(workspaceId, entity));
  return snapshot.docs.map((entry) => ({
    id: entry.id,
    ...(entry.data() as Record<string, unknown>),
    last_modified: String(entry.data().last_modified ?? ''),
    server_revision:
      typeof entry.data().server_revision === 'number' && Number.isFinite(entry.data().server_revision)
        ? (entry.data().server_revision as number)
        : 0,
  }));
}
