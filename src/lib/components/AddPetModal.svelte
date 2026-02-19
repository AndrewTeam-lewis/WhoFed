<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { supabase } from '$lib/supabase';
    import { t } from '$lib/services/i18n';
    
    export let householdId: string;
    
    const dispatch = createEventDispatcher();
    
    let name = '';
    let species = '';
    let icon = '🐾';
    let loading = false;
    let error = '';
    
    // Simple list for MVP
    const ICONS = ['🐶', '🐱', '🐾', '🐦', '🐠'];
    
    async function save() {
        if (!name.trim()) return;
        loading = true;
        
        try {
            const { error: err } = await supabase
                .from('pets')
                .insert({
                    household_id: householdId,
                    name: name.trim(),
                    species: species || 'Pet',
                    icon
                });
                
            if (err) throw err;
            
            dispatch('saved');
            dispatch('close');
            
        } catch (e: any) {
            console.error(e);
            error = e.message;
        } finally {
            loading = false;
        }
    }
</script>

<div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <button type="button" class="absolute inset-0 bg-black/50 backdrop-blur-sm" on:click={() => dispatch('close')}></button>
    <div class="bg-white rounded-[28px] p-6 w-full max-w-sm shadow-2xl relative z-10">
        <h3 class="text-xl font-bold mb-4">{$t.add_pet.title}</h3>
        
        <div class="space-y-4">
            <div>
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">{$t.add_pet.name_label}</label>
                <input type="text" bind:value={name} class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" placeholder={$t.add_pet.name_placeholder} />
            </div>
            
             <div>
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">{$t.add_pet.species_label}</label>
                <input type="text" bind:value={species} class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" placeholder={$t.add_pet.species_placeholder} />
            </div>
            
            <div>
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">{$t.add_pet.icon_label}</label>
                <div class="flex space-x-2">
                    {#each ICONS as i}
                        <button class="p-2 text-2xl border rounded-lg {icon === i ? 'border-brand-sage bg-green-50' : 'border-gray-100'}" on:click={() => icon = i}>
                            {i}
                        </button>
                    {/each}
                </div>
            </div>
            
            {#if error}
                <div class="text-red-500 text-sm">{error}</div>
            {/if}
            
            <button class="w-full py-3 bg-brand-sage text-white font-bold rounded-xl" on:click={save} disabled={loading || !name}>
                {loading ? $t.add_pet.saving : $t.add_pet.add_btn}
            </button>
        </div>
    </div>
</div>
