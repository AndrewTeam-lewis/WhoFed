<script lang="ts">
    import { fade, scale } from 'svelte/transition';
    import type { TimezoneOption } from '$lib/utils/timezones';
    import { t } from '$lib/services/i18n';

    export let timezones: TimezoneOption[] = [];
    export let value: string = '';
    export let disabled = false;
    
    let showDropdown = false;
    
    // Derived selected label
    $: selectedLabel = timezones.find(tz => tz.value === value)?.label || value || $t.timezone_select.default_label;
</script>

<div class="relative w-full">
    <!-- Trigger Button -->
    <button
        type="button"
        on:click={() => !disabled && (showDropdown = !showDropdown)}
        {disabled}
        class="w-full text-left px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/20 outline-none transition-all text-gray-900 flex justify-between items-center {disabled ? 'opacity-50 cursor-not-allowed' : ''}"
        aria-haspopup="listbox"
        aria-expanded={showDropdown}
    >
        <span class="truncate pr-4">{selectedLabel}</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 shrink-0 transition-transform duration-200 {showDropdown ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
    </button>
    
    {#if showDropdown}
        <!-- Invisible overlay to close on outside click -->
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="fixed inset-0 z-40" on:click|stopPropagation={() => showDropdown = false}></div>
        
        <!-- Dropdown Menu -->
        <div 
            class="absolute top-full left-0 mt-2 w-full max-h-[40vh] overflow-y-auto bg-white rounded-xl shadow-xl border border-gray-100 animate-scale-in origin-top z-50 py-1"
            transition:scale={{duration: 150, start: 0.95}}
            role="listbox"
        >
            {#if timezones.length === 0}
                <div class="p-4 text-center text-gray-500 text-sm">
                    {$t.timezone_select.no_timezones}
                </div>
            {:else}
                {#each timezones as tz}
                    <button
                        type="button"
                        class="w-full text-left px-4 py-3 text-sm font-medium hover:bg-gray-50 flex items-center justify-between transition-colors
                        {value === tz.value ? 'text-brand-sage bg-brand-sage/5' : 'text-gray-700'}"
                        on:click={() => {
                            value = tz.value;
                            showDropdown = false;
                        }}
                        role="option"
                        aria-selected={value === tz.value}
                    >
                        <span class="truncate pr-2">{tz.label}</span>
                        {#if value === tz.value}
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-brand-sage shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                            </svg>
                        {/if}
                    </button>
                {/each}
            {/if}
        </div>
    {/if}
</div>
