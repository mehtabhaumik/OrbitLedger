'use client';

import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { getWebStorage } from './firebase';

const MAX_IDENTITY_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_INSTRUMENT_IMAGE_BYTES = 8 * 1024 * 1024;
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

export function validatePaymentInstrumentImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return 'Use a PNG, JPG, or WebP image.';
  }

  if (file.size > MAX_INSTRUMENT_IMAGE_BYTES) {
    return 'Use an image smaller than 8 MB.';
  }

  return null;
}

export async function uploadPaymentInstrumentImage(
  workspaceId: string,
  paymentId: string,
  file: File
) {
  const error = validatePaymentInstrumentImage(file);
  if (error) {
    throw new Error(error);
  }

  const refined = await refinePaymentInstrumentImage(file);
  const storagePath = `workspaces/${workspaceId}/attachments/payment-instruments/${paymentId}-${Date.now()}.jpg`;
  const fileRef = ref(getWebStorage(), storagePath);
  await uploadBytes(fileRef, refined, {
    contentType: refined.type,
    customMetadata: {
      workspaceId,
      assetKind: 'payment-instrument',
      originalName: file.name,
    },
  });

  return {
    id: `${paymentId}-${Date.now()}`,
    name: file.name || 'Payment proof.jpg',
    url: await getDownloadURL(fileRef),
    storagePath,
    contentType: refined.type,
    size: refined.size,
    uploadedAt: new Date().toISOString(),
  };
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

async function refinePaymentInstrumentImage(file: File): Promise<Blob> {
  const image = await loadImage(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    return file;
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.84));
  return blob ?? file;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Payment proof image could not be read.'));
    };
    image.src = url;
  });
}
