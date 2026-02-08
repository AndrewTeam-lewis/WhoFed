<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { fade, scale } from 'svelte/transition';

    export let show = false;
    export let title = 'Select Option';
    export let items: { id: string; name: string; icon?: string }[] = [];
    export let selectedId: string = '';

    const dispatch = createEventDispatcher();

    function select(item: any) {
        dispatch('select', item);
        dispatch('close');
        show = false;
    }

    function close() {
        dispatch('close');
        show = false;
    }
</script>

{#if show}
    <div class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" transition:fade>
        <div class="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative" transition:scale>
            
            <!-- Header -->
            <div class="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 class="font-bold text-gray-800">{title}</h3>
                <button on:click={close} class="p-1 rounded-full hover:bg-gray-200 transition-colors text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- List -->
            <div class="max-h-[60vh] overflow-y-auto p-2">
                {#if items.length === 0}
                    <div class="p-8 text-center text-gray-500 text-sm">
                        No items found.
                    </div>
                {:else}
                    <div class="space-y-1">
                        {#each items as item}
                            <button 
                                class="w-full text-left p-3 rounded-xl flex items-center justify-between transition-colors {selectedId === item.id ? 'bg-brand-sage/10 text-brand-sage' : 'hover:bg-gray-50 text-gray-700'}"
                                on:click={() => select(item)}
                            >
                                <span class="font-medium flex items-center">
                                    {#if item.icon}
                                        <span class="mr-2">{item.icon}</span>
                                    {/if}
                                    {item.name}
                                </span>
                                {#if selectedId === item.id}
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                                    </svg>
                                {/if}
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>
            
        </div>
    </div>
{/if}
