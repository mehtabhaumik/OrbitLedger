'use client';

import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { getWebStorage } from './firebase';

const MAX_IDENTITY_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
]);

export type WorkspaceIdentityAssetKind = 'logo' | 'signature';

export function validateWorkspaceIdentityImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return 'Use a PNG, JPG, or WebP image.';
  }

  if (file.size > MAX_IDENTITY_IMAGE_BYTES) {
    return 'Use an image smaller than 2 MB.';
  }

  return null;
}

export async function uploadWorkspaceIdentityImage(
  workspaceId: string,
  kind: WorkspaceIdentityAssetKind,
  file: File
) {
  const error = validateWorkspaceIdentityImage(file);
  if (error) {
    throw new Error(error);
  }

  const folder = kind === 'logo' ? 'logos' : 'signatures';
  const extension = ALLOWED_IMAGE_TYPES.get(file.type) ?? 'png';
  const storagePath = `workspaces/${workspaceId}/${folder}/current-${Date.now()}.${extension}`;
  const fileRef = ref(getWebStorage(), storagePath);

  await uploadBytes(fileRef, file, {
    contentType: file.type,
    customMetadata: {
      workspaceId,
      assetKind: kind,
    },
  });

  return getDownloadURL(fileRef);
}

export async function deleteWorkspaceStorageFile(fileUrl: string | null | undefined) {
  if (!fileUrl) {
    return;
  }

  try {
    await deleteObject(ref(getWebStorage(), fileUrl));
  } catch {
    // A stale or already-removed file must not block profile saving.
  }
}
