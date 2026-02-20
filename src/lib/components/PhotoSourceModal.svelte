<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
  import { Capacitor } from '@capacitor/core';

  export let open = false;

  const dispatch = createEventDispatcher();
  let checking = false;
  let error = '';

  async function checkAndRequestPermissions(): Promise<boolean> {
    // Web fallback - no permissions needed
    if (!Capacitor.isNativePlatform()) {
      return true;
    }

    try {
      const permissions = await Camera.checkPermissions();

      if (permissions.camera === 'denied' || permissions.photos === 'denied') {
        error = 'Camera or photo access denied. Please enable in Settings.';
        return false;
      }

      if (permissions.camera === 'prompt' || permissions.photos === 'prompt') {
        const result = await Camera.requestPermissions();
        if (result.camera !== 'granted' && result.photos !== 'granted') {
          error = 'Permissions are required to take or select photos.';
          return false;
        }
      }

      return true;
    } catch (err: any) {
      error = err.message || 'Failed to check permissions';
      return false;
    }
  }

  async function handleCameraClick() {
    error = '';
    checking = true;

    const hasPermission = await checkAndRequestPermissions();
    if (!hasPermission) {
      checking = false;
      return;
    }

    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        quality: 90,
        allowEditing: false,
        correctOrientation: true
      });

      if (photo.dataUrl) {
        dispatch('select', photo.dataUrl);
        close();
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('cancelled')) {
        error = err.message || 'Failed to take photo';
      } else {
        close();
      }
    } finally {
      checking = false;
    }
  }

  async function handleGalleryClick() {
    error = '';
    checking = true;

    const hasPermission = await checkAndRequestPermissions();
    if (!hasPermission) {
      checking = false;
      return;
    }

    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        quality: 90,
        allowEditing: false,
        correctOrientation: true
      });

      if (photo.dataUrl) {
        dispatch('select', photo.dataUrl);
        close();
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('cancelled')) {
        error = err.message || 'Failed to select photo';
      } else {
        close();
      }
    } finally {
      checking = false;
    }
  }

  function close() {
    error = '';
    dispatch('close');
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      close();
    }
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" on:click={handleBackdropClick}>
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"></div>

    <!-- Modal -->
    <div class="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-xl relative z-10 animate-scale-in">
      <h3 class="text-center text-xl font-bold text-gray-900 mb-6">Add Pet Photo</h3>

      {#if error}
        <div class="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm text-center">
          {error}
        </div>
      {/if}

      <div class="space-y-3">
        <!-- Take Photo Button -->
        <button
          type="button"
          on:click={handleCameraClick}
          disabled={checking}
          class="w-full flex items-center justify-center gap-3 py-4 px-6 bg-brand-sage text-white font-bold rounded-2xl hover:bg-brand-sage/90 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Take Photo</span>
        </button>

        <!-- Choose from Library Button -->
        <button
          type="button"
          on:click={handleGalleryClick}
          disabled={checking}
          class="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white border-2 border-gray-200 text-gray-700 font-bold rounded-2xl hover:bg-gray-50 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Choose from Library</span>
        </button>

        <!-- Cancel Button -->
        <button
          type="button"
          on:click={close}
          disabled={checking}
          class="w-full py-3 text-gray-500 hover:text-gray-700 font-medium text-sm transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes scale-in {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.2s ease-out forwards;
  }

  .animate-scale-in {
    animation: scale-in 0.3s ease-out forwards;
  }
</style>
