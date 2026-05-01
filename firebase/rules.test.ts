import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'orbit-ledger-ci',
    firestore: {
      rules: readFileSync(resolve('firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('Firestore workspace rules', () => {
  it('allows an owner to create and read their workspace', async () => {
    const owner = testEnv.authenticatedContext('owner-1').firestore();
    const workspace = owner.collection('workspaces').doc('workspace-1');

    await assertSucceeds(
      workspace.set({
        owner_uid: 'owner-1',
        business_name: 'Orbit Store',
        owner_name: 'Owner',
        phone: '+91 98765 43210',
        email: 'owner@example.com',
        address: 'Main Road',
        currency: 'INR',
        country_code: 'IN',
        state_code: 'MH',
        data_state: 'profile_only',
        updated_at: '2026-01-01T00:00:00.000Z',
      })
    );

    await assertSucceeds(workspace.get());
  });

  it('blocks cross-owner workspace reads and writes', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('workspaces').doc('workspace-1').set({
        owner_uid: 'owner-1',
        business_name: 'Orbit Store',
        currency: 'INR',
        country_code: 'IN',
      });
    });

    const other = testEnv.authenticatedContext('owner-2').firestore();
    await assertFails(other.collection('workspaces').doc('workspace-1').get());
    await assertFails(
      other.collection('workspaces').doc('workspace-1').collection('customers').doc('customer-1').set({
        name: 'Blocked Customer',
      })
    );
  });

  it('allows only the owning user to access workspace records', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('workspaces').doc('workspace-1').set({
        owner_uid: 'owner-1',
        business_name: 'Orbit Store',
        currency: 'INR',
        country_code: 'IN',
      });
    });

    const owner = testEnv.authenticatedContext('owner-1').firestore();
    const customer = owner.collection('workspaces').doc('workspace-1').collection('customers').doc('customer-1');
    await assertSucceeds(customer.set({ name: 'Allowed Customer' }));

    const snapshot = await assertSucceeds(customer.get());
    expect(snapshot.exists).toBe(true);
  });
});
