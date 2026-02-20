<script>
  import { goto } from '$app/navigation';
  import { currentLanguage, t } from '$lib/services/i18n';
  import PrivacyEn from '$lib/components/legal/PrivacyEn.svelte';
  import PrivacyPt from '$lib/components/legal/PrivacyPt.svelte';
</script>

<div class="min-h-screen bg-white pb-20">
    <!-- Header -->
    <header class="bg-white px-6 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center border-b border-gray-100 sticky top-0 z-10">
        <button on:click={() => history.back()} class="mr-4 p-2 -ml-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
            </svg>
        </button>
        <h1 class="text-xl font-bold text-gray-900">{$t.settings.privacy_policy || 'Privacy Policy'}</h1>
    </header>

    <main class="p-6 max-w-lg mx-auto prose prose-sm prose-sage">
        {#if $currentLanguage === 'pt'}
            <PrivacyPt />
        {:else}
            <PrivacyEn />
        {/if}
    </main>
</div>
