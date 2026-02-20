<script lang="ts">
  import { t, currentLanguage, setLanguage, type Language } from '$lib/services/i18n';
  import { scale } from 'svelte/transition';

  let showDropdown = false;

  const languages = [
    { id: 'en' as Language, name: 'English', icon: '🇺🇸' },
    { id: 'pt' as Language, name: 'Português', icon: '🇧🇷' }
  ];

  function selectLanguage(lang: Language) {
    setLanguage(lang);
    showDropdown = false;
  }

  function toggleDropdown() {
    showDropdown = !showDropdown;
  }

  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.language-picker-container')) {
      showDropdown = false;
    }
  }

  $: currentLang = languages.find(l => l.id === $currentLanguage) || languages[0];
</script>

<svelte:window on:click={handleClickOutside} />

<div class="language-picker-container fixed top-4 right-4 md:top-6 md:right-6 z-50">
  <button
    on:click|stopPropagation={toggleDropdown}
    class="flex items-center gap-2 px-3 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm hover:shadow-md transition-all border border-gray-200 hover:border-brand-sage/30"
    aria-label={$t.settings.select_language}
    aria-expanded={showDropdown}
  >
    <span class="text-xl">{currentLang.icon}</span>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-4 w-4 text-gray-500 transition-transform {showDropdown ? 'rotate-180' : ''}"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  {#if showDropdown}
    <div
      class="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden min-w-[160px]"
      transition:scale={{ duration: 150, start: 0.95 }}
    >
      {#each languages as lang}
        <button
          on:click|stopPropagation={() => selectLanguage(lang.id)}
          class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors {$currentLanguage === lang.id ? 'bg-brand-sage/5 text-brand-sage' : 'text-gray-700'}"
        >
          <span class="text-xl">{lang.icon}</span>
          <span class="font-medium text-sm">{lang.name}</span>
          {#if $currentLanguage === lang.id}
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-auto" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  /* Ensure component doesn't interfere with page scroll */
  .language-picker-container {
    pointer-events: auto;
  }
</style>
