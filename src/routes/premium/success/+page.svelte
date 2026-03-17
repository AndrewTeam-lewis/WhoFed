<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { t } from '$lib/services/i18n';

  let loading = true;
  let countdown = 5;

  onMount(() => {
    const sessionId = $page.url.searchParams.get('session_id');

    if (!sessionId) {
      goto('/settings');
      return;
    }

    // Show success for 5 seconds then redirect
    const timer = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(timer);
        goto('/settings');
      }
    }, 1000);

    loading = false;

    return () => clearInterval(timer);
  });
</script>

<svelte:head>
  <title>Welcome to Premium! - WhoFed</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-brand-sage to-brand-sage/90 flex items-center justify-center p-6">
  <div class="bg-white rounded-[32px] p-8 w-full max-w-md shadow-2xl text-center animate-scale-in">
    <!-- Success Icon -->
    <div class="w-20 h-20 bg-brand-sage/10 rounded-full flex items-center justify-center mx-auto mb-6">
      <div class="text-5xl">💎</div>
    </div>

    <!-- Title -->
    <h1 class="text-3xl font-bold text-gray-900 mb-3">
      {$t.premium_success.welcome}
    </h1>

    <p class="text-gray-600 mb-8 leading-relaxed">
      {$t.premium_success.description}
    </p>

    <!-- Feature List -->
    <div class="bg-brand-sage/5 rounded-2xl p-6 mb-8 text-left">
      <div class="space-y-3">
        <div class="flex items-center">
          <svg class="h-5 w-5 text-brand-sage mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-sm text-gray-700">{$t.premium_success.unlimited_pets}</span>
        </div>
        <div class="flex items-center">
          <svg class="h-5 w-5 text-brand-sage mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-sm text-gray-700">{$t.premium_success.custom_photos}</span>
        </div>
        <div class="flex items-center">
          <svg class="h-5 w-5 text-brand-sage mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-sm text-gray-700">{$t.premium_success.multiple_households}</span>
        </div>
        <div class="flex items-center">
          <svg class="h-5 w-5 text-brand-sage mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-sm text-gray-700">{$t.premium_success.pdf_exports}</span>
        </div>
      </div>
    </div>

    <!-- Redirect Info -->
    <p class="text-sm text-gray-400 mb-4">
      {$t.premium_success.redirecting.replace('{countdown}', countdown)}
    </p>

    <button
      on:click={() => goto('/settings')}
      class="text-brand-sage font-bold hover:underline text-sm"
    >
      {$t.premium_success.go_now}
    </button>
  </div>
</div>

<style>
  @keyframes scale-in {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .animate-scale-in {
    animation: scale-in 0.3s ease-out;
  }
</style>
