import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  try {
    testEnv = await initializeTestEnvironment({
      projectId: 'orbit-ledger-ci',
      firestore: {
        rules: readFileSync(resolve('firestore.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
      storage: {
        rules: readFileSync(resolve('storage.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 9199,
      },
    });
  } catch (error) {
    throw new Error(
      `Storage rules tests require Firebase Firestore and Storage emulators on 127.0.0.1:8080 and 127.0.0.1:9199. ` +
        `Run npm run test:rules:emulators, and make sure Java 11 or newer is active. ${String(error)}`
    );
  }
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedWorkspace('workspace-1', 'owner-1');
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('Storage workspace rules', () => {
  it('allows an owner to upload and read allowed workspace assets', async () => {
    const ownerStorage = testEnv.authenticatedContext('owner-1').storage();
    const logoRef = ownerStorage.ref('workspaces/workspace-1/logos/logo.png');
    const watermarkRef = ownerStorage.ref('workspaces/workspace-1/watermarks/mark.webp');
    const invoiceRef = ownerStorage.ref('workspaces/workspace-1/documents/invoices/invoice.pdf');
    const attachmentRef = ownerStorage.ref('workspaces/workspace-1/attachments/payment-instruments/proof.webp');

    await assertSucceeds(upload(logoRef, bytes(128), 'image/png'));
    await assertSucceeds(upload(watermarkRef, bytes(128), 'image/webp'));
    await assertSucceeds(upload(invoiceRef, bytes(512), 'application/pdf'));
    await assertSucceeds(upload(attachmentRef, bytes(256), 'image/webp'));
    await assertSucceeds(logoRef.getDownloadURL());
    await assertSucceeds(watermarkRef.getDownloadURL());
  });

  it('blocks signed-out and cross-workspace access', async () => {
    const ownerStorage = testEnv.authenticatedContext('owner-1').storage();
    const otherStorage = testEnv.authenticatedContext('owner-2').storage();
    const signedOutStorage = testEnv.unauthenticatedContext().storage();
    const logoPath = 'workspaces/workspace-1/logos/private-logo.png';

    await assertSucceeds(upload(ownerStorage.ref(logoPath), bytes(128), 'image/png'));

    await assertFails(otherStorage.ref(logoPath).getDownloadURL());
    await assertFails(upload(otherStorage.ref('workspaces/workspace-1/logos/blocked.png'), bytes(128), 'image/png'));
    await assertFails(signedOutStorage.ref(logoPath).getDownloadURL());
  });

  it('blocks unsupported file types and oversized uploads', async () => {
    const ownerStorage = testEnv.authenticatedContext('owner-1').storage();

    await assertFails(
      upload(ownerStorage.ref('workspaces/workspace-1/logos/logo.svg'), bytes(128), 'image/svg+xml')
    );
    await assertFails(
      upload(
        ownerStorage.ref('workspaces/workspace-1/logos/too-large.png'),
        bytes(2 * 1024 * 1024 + 1),
        'image/png'
      )
    );
    await assertFails(
      upload(
        ownerStorage.ref('workspaces/workspace-1/documents/invoices/not-a-pdf.txt'),
        bytes(128),
        'text/plain'
      )
    );
  });

  it('keeps backups, imports, and unknown paths constrained', async () => {
    const ownerStorage = testEnv.authenticatedContext('owner-1').storage();

    await assertSucceeds(
      upload(ownerStorage.ref('workspaces/workspace-1/backups/backup.json'), bytes(512), 'application/json')
    );
    await assertSucceeds(
      upload(ownerStorage.ref('workspaces/workspace-1/imports/customers.csv'), bytes(512), 'text/csv')
    );
    await assertFails(
      upload(ownerStorage.ref('workspaces/workspace-1/backups/backup.exe'), bytes(512), 'application/x-msdownload')
    );
    await assertFails(
      upload(ownerStorage.ref('workspaces/workspace-1/private/loose-file.pdf'), bytes(512), 'application/pdf')
    );
  });
});

async function seedWorkspace(workspaceId: string, ownerUid: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().collection('workspaces').doc(workspaceId).set({
      owner_uid: ownerUid,
      business_name: 'Orbit Store',
      currency: 'INR',
      country_code: 'IN',
      updated_at: '2026-05-05T00:00:00.000Z',
    });
  });
}

function upload(
  ref: firebase.storage.Reference,
  data: Uint8Array,
  contentType: string
): Promise<firebase.storage.UploadTaskSnapshot> {
  return ref.put(data, { contentType });
}

function bytes(size: number) {
  return new Uint8Array(size).fill(1);
}
