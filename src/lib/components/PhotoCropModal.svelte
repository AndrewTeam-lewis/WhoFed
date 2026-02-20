<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import Croppie from 'croppie';
  import 'croppie/croppie.css';

  export let imageDataUrl: string;
  export let open = false;

  const dispatch = createEventDispatcher();

  let cropContainer: HTMLDivElement;
  let croppieInstance: Croppie | null = null;
  let saving = false;
  let error = '';
  let rotation = 0;

  onMount(() => {
    console.log('[PhotoCropModal] onMount called');
    console.log('[PhotoCropModal] cropContainer:', !!cropContainer);
    console.log('[PhotoCropModal] imageDataUrl:', !!imageDataUrl);

    // Wait for next tick to ensure DOM is ready
    setTimeout(() => {
      console.log('[PhotoCropModal] setTimeout fired, calling initializeCroppie');
      initializeCroppie();
    }, 50);
  });

  onDestroy(() => {
    console.log('[PhotoCropModal] onDestroy called');
    console.log('[PhotoCropModal] croppieInstance exists:', !!croppieInstance);

    if (croppieInstance) {
      try {
        console.log('[PhotoCropModal] Destroying Croppie instance...');
        croppieInstance.destroy();
        console.log('[PhotoCropModal] Croppie destroyed successfully');
      } catch (e) {
        console.error('[PhotoCropModal] Error destroying croppie:', e);
      }
      croppieInstance = null;
    }

    // Clean up element state
    if (cropContainer) {
      // Clear any Croppie data from the element
      if ((cropContainer as any).croppie) {
        console.log('[PhotoCropModal] Cleaning up element.croppie property');
        delete (cropContainer as any).croppie;
      }
      // Clear the element's children to remove all Croppie DOM
      console.log('[PhotoCropModal] Clearing element innerHTML');
      cropContainer.innerHTML = '';
    }
  });

  function initializeCroppie() {
    console.log('[PhotoCropModal] initializeCroppie called');
    console.log('[PhotoCropModal] croppieInstance exists:', !!croppieInstance);
    console.log('[PhotoCropModal] cropContainer exists:', !!cropContainer);
    console.log('[PhotoCropModal] imageDataUrl exists:', !!imageDataUrl);

    // Guard: If we already have an instance, don't create another one
    if (croppieInstance) {
      console.warn('[PhotoCropModal] Croppie instance already exists, skipping initialization');
      return;
    }

    if (!cropContainer || !imageDataUrl) {
      console.warn('[PhotoCropModal] Missing cropContainer or imageDataUrl, aborting');
      return;
    }

    // Validate image size
    const sizeInMB = (imageDataUrl.length * 3 / 4) / (1024 * 1024);
    if (sizeInMB > 10) {
      error = 'Image too large (>10MB). Please choose a smaller image.';
      return;
    }

    try {
      // ALWAYS clear the container and create a fresh div
      console.log('[PhotoCropModal] Clearing container and creating fresh element...');
      cropContainer.innerHTML = '';

      // Create a completely new div element for Croppie
      const croppieElement = document.createElement('div');
      cropContainer.appendChild(croppieElement);

      console.log('[PhotoCropModal] Creating new Croppie instance on fresh element...');
      croppieInstance = new Croppie(croppieElement, {
        viewport: { width: 256, height: 256, type: 'circle' },
        boundary: { width: 300, height: 300 },
        showZoomer: true,
        enableExif: true,
        enableOrientation: true,
        enableResize: false,
        enableZoom: true,
        mouseWheelZoom: false
      });

      console.log('[PhotoCropModal] Binding image to Croppie...');
      croppieInstance.bind({ url: imageDataUrl });
      console.log('[PhotoCropModal] Croppie initialized successfully!');
    } catch (err: any) {
      error = err.message || 'Failed to initialize crop tool';
      console.error('[PhotoCropModal] Croppie initialization error:', err);
    }
  }

  function handleRotate() {
    if (!croppieInstance) return;

    rotation = (rotation + 90) % 360;
    croppieInstance.rotate(90);
  }

  async function handleSave() {
    if (!croppieInstance) return;

    const startTime = performance.now();
    saving = true;
    error = '';

    try {
      console.log('[PhotoCropModal] Starting blob generation...');
      const blobStart = performance.now();
      const blob = await croppieInstance.result({
        type: 'blob',
        size: 'viewport',
        format: 'jpeg',
        quality: 0.85,
        circle: false  // We want square output with transparent corners handled by CSS
      }) as Blob;
      const blobEnd = performance.now();
      console.log(`[PhotoCropModal] ⏱️ Blob generation took ${(blobEnd - blobStart).toFixed(0)}ms`);
      console.log(`[PhotoCropModal] Blob size: ${(blob.size / 1024).toFixed(1)}KB`);

      if (!blob) {
        throw new Error('Failed to generate image');
      }

      // Validate output size
      if (blob.size > 5 * 1024 * 1024) {
        throw new Error('Cropped image too large. Please zoom in more.');
      }

      const totalTime = performance.now() - startTime;
      console.log(`[PhotoCropModal] ⏱️ Total handleSave time: ${(totalTime).toFixed(0)}ms`);

      dispatch('save', { blob });
    } catch (err: any) {
      error = err.message || 'Failed to crop image';
      saving = false;
    }
  }

  function handleCancel() {
    dispatch('cancel');
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  }
</script>

{#if open}
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center p-4" 
    on:click={handleBackdropClick}
    on:keydown={(e) => e.key === 'Escape' && handleCancel()}
    role="presentation"
  >
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"></div>

    <!-- Modal -->
    <div class="bg-white rounded-[32px] p-6 w-full max-w-md shadow-xl relative z-10 animate-scale-in">
      <h3 class="text-center text-xl font-bold text-gray-900 mb-4">Crop & Zoom Photo</h3>

      {#if error}
        <div class="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm text-center">
          {error}
        </div>
      {/if}

      <!-- Croppie Container -->
      <div class="mb-6">
        <div bind:this={cropContainer} class="croppie-container"></div>
      </div>

      <!-- Rotate Button -->
      <div class="flex justify-center mb-6">
        <button
          type="button"
          on:click={handleRotate}
          disabled={saving || !!error}
          class="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Rotate</span>
        </button>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-3">
        <button
          type="button"
          on:click={handleCancel}
          disabled={saving}
          class="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>

        <button
          type="button"
          on:click={handleSave}
          disabled={saving || !!error}
          class="flex-1 py-3 px-4 bg-brand-sage hover:bg-brand-sage/90 text-white font-bold rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {#if saving}
            <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Saving...</span>
          {:else}
            <span>Save</span>
          {/if}
        </button>
      </div>

      <!-- Hint Text -->
      <p class="text-center text-xs text-gray-500 mt-4">
        Pinch to zoom • Drag to reposition
      </p>
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

  :global(.croppie-container) {
    width: 100%;
    height: auto;
  }

  :global(.croppie-container .cr-boundary) {
    width: 300px !important;
    height: 300px !important;
    margin: 0 auto;
  }

  :global(.croppie-container .cr-slider-wrap) {
    margin-top: 20px;
  }

  :global(.croppie-container .cr-slider) {
    width: 100%;
  }

  /* Custom slider styling to match brand */
  :global(.croppie-container .cr-slider::-webkit-slider-thumb) {
    background: #6b9e78; /* brand-sage */
  }

  :global(.croppie-container .cr-slider::-moz-range-thumb) {
    background: #6b9e78; /* brand-sage */
  }
</style>
