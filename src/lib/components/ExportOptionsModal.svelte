
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { fade, scale } from 'svelte/transition';
    import { exportService, type ExportOptions } from '$lib/services/export';
    import SelectionModal from '$lib/components/SelectionModal.svelte';
    import { t } from '$lib/services/i18n';
    
    export let show = false;
    export let households: { id: string, name: string }[] = [];
    export let pets: { id: string, name: string, household_id: string }[] = [];

    const dispatch = createEventDispatcher();

    let loading = false;
    let error = '';
    
    // Selection State
    let selectedMode: 'full' | 'household' | 'medical' = 'full';
    let selectedHouseholdId = '';
    let selectedPetId = '';
    
    let showHouseholdPicker = false;
    let showPetPicker = false;
    let isOpen = false;
    $: if (show) {
        if (!isOpen) {
            // First open
            isOpen = true;
            selectedMode = 'full';
            selectedHouseholdId = households.length > 0 ? households[0].id : '';
            selectedPetId = pets.length > 0 ? pets[0].id : '';
            error = '';
            console.log('Export Modal Opened', { 
                households: households.length, 
                pets: pets.length 
            });
        }
    } else {
        isOpen = false;
    }

    // Filter pets based on selected household if in household mode (though medical is global pet list usually, or we can filter)
    // For simplicity, let's just show all pets in dropdown or group them.
    
    async function handleExport() {
        loading = true;
        error = '';
        
        try {
            const options: ExportOptions = {
                scope: selectedMode === 'full' ? 'all' : selectedMode === 'household' ? 'household' : 'pet',
                id: selectedMode === 'household' ? selectedHouseholdId : selectedMode === 'medical' ? selectedPetId : undefined,
                medicalOnly: selectedMode === 'medical'
            };

            if (selectedMode === 'household' && !selectedHouseholdId) throw new Error($t.export?.error_select_household || 'Please select a household.');
            if (selectedMode === 'medical' && !selectedPetId) throw new Error($t.export?.error_select_pet || 'Please select a pet.');

            await exportService.exportData(options);
            
            // Close on success
            dispatch('close');
            show = false;
        } catch (e: any) {
            console.error('Export failed:', e);
            error = e.message || $t.export?.error_failed || 'Export failed';
        } finally {
            loading = false;
        }
    }
</script>

{#if show}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" transition:fade>
        <div class="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" transition:scale>
            
            <!-- Header -->
            <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-brand-sage/5">
                <h2 class="text-xl font-bold text-brand-sage">{$t.export?.title || 'Export Data'}</h2>
                <button on:click={() => { show = false; dispatch('close'); }} class="text-gray-400 hover:text-gray-600">
                    <span class="text-2xl">&times;</span>
                </button>
            </div>

            <!-- Content -->
            <div class="p-6 space-y-6">
                
                {#if error}
                    <div class="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>
                {/if}

                <div class="space-y-3">
                    <label class="flex items-center p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors {selectedMode === 'full' ? 'border-brand-sage bg-brand-sage/5' : 'border-gray-200'}">
                        <input type="radio" name="exportMode" value="full" bind:group={selectedMode} class="text-brand-sage focus:ring-brand-sage" />
                        <div class="ml-3">
                            <span class="block font-semibold text-gray-800">{$t.export?.full_archive || 'Full Archive'}</span>
                            <span class="block text-xs text-gray-500">{$t.export?.full_archive_desc || 'All data across all households and pets'}</span>
                        </div>
                    </label>

                    <label class="flex items-center p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors {selectedMode === 'household' ? 'border-brand-sage bg-brand-sage/5' : 'border-gray-200'}">
                        <input type="radio" name="exportMode" value="household" bind:group={selectedMode} class="text-brand-sage focus:ring-brand-sage" />
                        <div class="ml-3">
                            <span class="block font-semibold text-gray-800">{$t.export?.household_history || 'Household History'}</span>
                            <span class="block text-xs text-gray-500">{$t.export?.household_history_desc || 'Everything for a specific household'}</span>
                        </div>
                    </label>
                    
                    {#if selectedMode === 'household'}
                        <div class="ml-8 mt-2" transition:fade>
                            <button 
                                class="w-full p-3 rounded-xl border border-gray-300 text-sm bg-white flex items-center justify-between hover:border-brand-sage transition-colors text-left"
                                on:click={() => showHouseholdPicker = true}
                            >
                                <span class={selectedHouseholdId ? 'text-gray-900' : 'text-gray-500'}>
                                    {households.find(h => h.id === selectedHouseholdId)?.name || ($t.export?.select_household || 'Select Household')}
                                </span>
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        </div>
                    {/if}

                    <label class="flex items-center p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors {selectedMode === 'medical' ? 'border-brand-sage bg-brand-sage/5' : 'border-gray-200'}">
                        <input type="radio" name="exportMode" value="medical" bind:group={selectedMode} class="text-brand-sage focus:ring-brand-sage" />
                        <div class="ml-3">
                            <span class="block font-semibold text-gray-800">{$t.export?.medical_history || 'Medical History'}</span>
                            <span class="block text-xs text-gray-500">{$t.export?.medical_history_desc || 'Medical records for a specific pet'}</span>
                        </div>
                    </label>

                    {#if selectedMode === 'medical'}
                         <div class="ml-8 mt-2" transition:fade>
                            <button 
                                class="w-full p-3 rounded-xl border border-gray-300 text-sm bg-white flex items-center justify-between hover:border-brand-sage transition-colors text-left"
                                on:click={() => showPetPicker = true}
                            >
                                <span class={selectedPetId ? 'text-gray-900' : 'text-gray-500'}>
                                    {pets.find(p => p.id === selectedPetId)?.name || ($t.export?.select_pet || 'Select Pet')}
                                </span>
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        </div>
                    {/if}
                </div>

                <!-- Pickers -->
                <SelectionModal
                    bind:show={showHouseholdPicker}
                    title={$t.export?.select_household || 'Select Household'}
                    items={households}
                    selectedId={selectedHouseholdId}
                    on:select={(e) => selectedHouseholdId = e.detail.id}
                />

                <SelectionModal
                    bind:show={showPetPicker}
                    title={$t.export?.select_pet || 'Select Pet'}
                    items={pets}
                    selectedId={selectedPetId}
                    on:select={(e) => selectedPetId = e.detail.id}
                />

            </div>

            <!-- Footer -->
            <div class="p-6 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
                <button 
                    on:click={() => { show = false; dispatch('close'); }}
                    class="px-4 py-2 text-gray-600 font-medium hover:text-gray-800 transition-colors"
                >
                    {$t.export?.cancel || 'Cancel'}
                </button>
                <button 
                    on:click={handleExport}
                    disabled={loading}
                    class="px-6 py-2 bg-brand-sage text-white font-medium rounded-xl shadow-lg shadow-brand-sage/20 hover:bg-brand-sage-dark transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                    {#if loading}
                        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {$t.export?.exporting || 'Exporting...'}
                    {:else}
                        {$t.export?.generate_pdf || 'Generate PDF'}
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}
