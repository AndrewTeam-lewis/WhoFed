<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { notificationService } from '$lib/services/notifications';
  import { Capacitor } from '@capacitor/core';
  import { t } from '$lib/services/i18n';

  const dispatch = createEventDispatcher();

  let loading = false;

  async function handleEnable() {
    loading = true;
    try {
      await notificationService.subscribeToPush();
      dispatch('close');
    } catch (error) {
      console.error('Failed to enable notifications:', error);
      // Close anyway - user can enable from settings later
      dispatch('close');
    } finally {
      loading = false;
    }
  }

  function handleSkip() {
    dispatch('close');
  }
</script>

<div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
  <!-- Backdrop -->
  <div class="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"></div>

  <!-- Modal -->
  <div class="bg-white rounded-[32px] w-full max-w-sm relative z-10 animate-scale-in p-8">
    <div class="text-center mb-6">
      <div class="w-16 h-16 bg-brand-sage/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-brand-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </div>
      <h3 class="text-xl font-bold text-gray-900 mb-2">Never Miss a Feeding! 🐾</h3>
      <p class="text-sm text-gray-500">Get notified when it's time to feed, give meds, or care for your pets.</p>
    </div>

    <div class="space-y-3">
      <button
        on:click={handleEnable}
        disabled={loading}
        class="w-full py-3 bg-brand-sage text-white font-bold rounded-2xl shadow-lg shadow-brand-sage/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {#if loading}
          <span class="flex items-center justify-center gap-2">
            <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Enabling...
          </span>
        {:else}
          Enable Notifications
        {/if}
      </button>

      <button
        on:click={handleSkip}
        class="w-full py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors text-sm"
      >
        Maybe Later
      </button>
    </div>

    <p class="text-xs text-gray-400 text-center mt-4">
      You can change this anytime in Settings
    </p>
  </div>
</div>

<style>
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes scale-in {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
  .animate-fade-in {
    animation: fade-in 0.2s ease-out;
  }
  .animate-scale-in {
    animation: scale-in 0.3s ease-out;
  }
</style>
