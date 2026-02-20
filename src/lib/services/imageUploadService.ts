import { supabase } from '$lib/supabase';

export interface UploadResult {
  publicUrl: string;
  path: string;
}

/**
 * Upload both original and thumbnail for a pet avatar
 * @param userId - The user's ID (used for folder structure)
 * @param originalBlob - The original full-resolution image blob
 * @param thumbnailBlob - The cropped thumbnail blob (256x256)
 * @param petId - Optional pet ID for consistent naming (uses timestamp if not provided)
 * @returns Promise with publicUrl and storage paths
 */
export async function uploadPetPhotos(
  userId: string,
  originalBlob: Blob,
  thumbnailBlob: Blob,
  petId?: string
): Promise<{ publicUrl: string; originalPath: string; thumbnailPath: string }> {
  const baseName = petId || Date.now();
  const originalPath = `${userId}/${baseName}-original.jpg`;
  const thumbnailPath = `${userId}/${baseName}.jpg`;

  // Upload original with retry logic
  const uploadOriginal = async () => {
    const start = performance.now();
    const { error } = await supabase.storage
      .from('pet-avatars')
      .upload(originalPath, originalBlob, {
        upsert: true,
        contentType: 'image/jpeg'
      });
    const end = performance.now();
    console.log(`[uploadPetPhotos] ⏱️ Original upload took ${(end - start).toFixed(0)}ms (${(originalBlob.size / 1024).toFixed(1)}KB)`);
    if (error) throw new Error(error.message || 'Original upload failed');
  };

  // Upload thumbnail with retry logic
  const uploadThumbnail = async () => {
    const start = performance.now();
    const { error } = await supabase.storage
      .from('pet-avatars')
      .upload(thumbnailPath, thumbnailBlob, {
        upsert: true,
        contentType: 'image/jpeg'
      });
    const end = performance.now();
    console.log(`[uploadPetPhotos] ⏱️ Thumbnail upload took ${(end - start).toFixed(0)}ms (${(thumbnailBlob.size / 1024).toFixed(1)}KB)`);
    if (error) throw new Error(error.message || 'Thumbnail upload failed');
  };

  // Upload both in parallel for better performance
  await Promise.all([
    retryWithBackoff(uploadOriginal, 3),
    retryWithBackoff(uploadThumbnail, 3)
  ]);

  const { data: { publicUrl } } = supabase.storage
    .from('pet-avatars')
    .getPublicUrl(thumbnailPath);

  return { publicUrl, originalPath, thumbnailPath };
}

/**
 * Upload a pet avatar image to Supabase Storage with retry logic
 * @param userId - The user's ID (used for folder structure)
 * @param imageBlob - The image blob to upload (should be optimized JPEG)
 * @param petId - Optional pet ID for consistent naming (uses timestamp if not provided)
 * @returns Promise with publicUrl and storage path
 */
export async function uploadPetAvatar(
  userId: string,
  imageBlob: Blob,
  petId?: string
): Promise<UploadResult> {
  const fileName = `${petId || Date.now()}.jpg`;
  const filePath = `${userId}/${fileName}`;

  // Upload with retry logic
  const uploadFn = async () => {
    const { error } = await supabase.storage
      .from('pet-avatars')
      .upload(filePath, imageBlob, {
        upsert: true, // Replace existing file if it exists
        contentType: 'image/jpeg'
      });

    if (error) {
      throw new Error(error.message || 'Upload failed');
    }

    const { data: { publicUrl } } = supabase.storage
      .from('pet-avatars')
      .getPublicUrl(filePath);

    return { publicUrl, path: filePath };
  };

  // Retry with exponential backoff (max 3 attempts)
  return await retryWithBackoff(uploadFn, 3);
}

/**
 * Delete a pet avatar from Supabase Storage (both thumbnail and original)
 * @param filePath - The storage path of the thumbnail file to delete
 */
export async function deletePetAvatar(filePath: string): Promise<void> {
  console.log('[deletePetAvatar] Attempting to delete:', filePath);

  // Delete thumbnail
  const { error, data } = await supabase.storage
    .from('pet-avatars')
    .remove([filePath]);

  if (error) {
    console.error('[deletePetAvatar] Failed to delete pet avatar:', error);
    console.error('[deletePetAvatar] Error details:', JSON.stringify(error));
  } else {
    console.log('[deletePetAvatar] Successfully deleted thumbnail:', data);
  }

  // Also delete original (if it exists)
  // Convert path like "userId/petId.jpg" to "userId/petId-original.jpg"
  const originalPath = filePath.replace(/\.jpg$/, '-original.jpg');
  console.log('[deletePetAvatar] Attempting to delete original:', originalPath);

  const { error: origError, data: origData } = await supabase.storage
    .from('pet-avatars')
    .remove([originalPath]);

  if (origError) {
    console.error('[deletePetAvatar] Failed to delete original (may not exist):', origError);
  } else {
    console.log('[deletePetAvatar] Successfully deleted original:', origData);
  }
}

/**
 * Fetch the original full-resolution photo for editing
 * @param userId - The user's ID
 * @param petId - The pet's ID
 * @returns Promise with the original photo as a Blob
 */
export async function fetchOriginalPhoto(userId: string, petId: string): Promise<Blob> {
  const originalPath = `${userId}/${petId}-original.jpg`;
  console.log('[fetchOriginalPhoto] Fetching original from:', originalPath);

  const { data, error } = await supabase.storage
    .from('pet-avatars')
    .download(originalPath);

  if (error || !data) {
    console.error('[fetchOriginalPhoto] Failed to fetch original:', error);
    throw new Error('Failed to fetch original photo. It may have been uploaded before the edit feature was added.');
  }

  console.log('[fetchOriginalPhoto] Successfully fetched original, size:', data.size);
  return data;
}

/**
 * Retry a function with exponential backoff
 * @param fn - The async function to retry
 * @param maxRetries - Maximum number of retry attempts
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      // If this was the last retry, throw the error
      if (i === maxRetries - 1) {
        throw error;
      }

      // Wait with exponential backoff: 1s, 2s, 4s...
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Retry failed'); // Should never reach here
}

/**
 * Generate a storage path for a pet avatar
 * @param userId - The user's ID
 * @param petId - Optional pet ID
 * @returns The storage path string
 */
export function generatePetAvatarPath(userId: string, petId?: string): string {
  const fileName = `${petId || Date.now()}.jpg`;
  return `${userId}/${fileName}`;
}
