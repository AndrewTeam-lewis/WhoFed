<script lang="ts">
  import { onMount } from 'svelte';
  import { Capacitor } from '@capacitor/core';

  let showBanner = false;
  let currentPath = '';

  onMount(() => {
    // Don't show banner if already in native app
    if (Capacitor.isNativePlatform()) {
      return;
    }

    // Only show on mobile devices
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) {
      return;
    }

    currentPath = window.location.pathname + window.location.search + window.location.hash;

    // Try to open in app automatically for deep links
    const isDeepLink = currentPath.includes('/auth/') ||
                       currentPath.includes('/pets/') ||
                       currentPath.includes('/app/');

    if (isDeepLink) {
      tryOpenInApp();
    } else {
      // Show banner for homepage
      showBanner = true;
    }
  });

  function tryOpenInApp() {
    const appUrl = `whofed://${currentPath}`;

    // Try to open in app
    window.location.href = appUrl;

    // Show banner after short delay if still on page (app not installed)
    setTimeout(() => {
      showBanner = true;
    }, 1500);
  }

  function openInApp() {
    tryOpenInApp();
  }

  function closeBanner() {
    showBanner = false;
  }
</script>

{#if showBanner}
  <div class="fixed top-0 left-0 right-0 z-[200] bg-brand-sage text-white shadow-lg animate-slide-down">
    <div class="flex items-center justify-between p-3 max-w-screen-xl mx-auto">
      <div class="flex items-center space-x-3 flex-1 min-w-0">
        <img src="/whofed_logo_email_tiny.png" alt="WhoFed" class="w-8 h-8 rounded-lg bg-white/10 p-1" />
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-sm">Open in WhoFed App</div>
          <div class="text-xs text-white/80">For the best experience</div>
        </div>
      </div>
      <div class="flex items-center space-x-2 ml-2">
        <button
          on:click={openInApp}
          class="bg-white text-brand-sage font-bold px-4 py-2 rounded-lg text-sm whitespace-nowrap hover:bg-white/90 transition-colors"
        >
          Open App
        </button>
        <button
          on:click={closeBanner}
          class="text-white/80 hover:text-white p-2 transition-colors"
          aria-label="Close"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes slide-down {
    from {
      transform: translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .animate-slide-down {
    animation: slide-down 0.3s ease-out;
  }
</style>
