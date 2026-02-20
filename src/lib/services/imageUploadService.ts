import { supabase } from '$lib/supabase';

export interface UploadResult {
  publicUrl: string;
  path: string;
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
 * Delete a pet avatar from Supabase Storage
 * @param filePath - The storage path of the file to delete
 */
export async function deletePetAvatar(filePath: string): Promise<void> {
  console.log('[deletePetAvatar] Attempting to delete:', filePath);
  const { error, data } = await supabase.storage
    .from('pet-avatars')
    .remove([filePath]);

  if (error) {
    console.error('[deletePetAvatar] Failed to delete pet avatar:', error);
    console.error('[deletePetAvatar] Error details:', JSON.stringify(error));
    // Don't throw - deletion failure is non-critical
  } else {
    console.log('[deletePetAvatar] Successfully deleted:', data);
  }
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
