<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { supabase } from '$lib/supabase';
    import { t } from '$lib/services/i18n';
    import { getUserTimezone, getAllTimezones } from '$lib/utils/timezones';
    
    export let userId: string;
    
    const dispatch = createEventDispatcher();
    
    let householdName = '';
    let householdTimezone = getUserTimezone();
    let timezones = getAllTimezones();
    let loading = false;
    let error = '';
    
    async function createHousehold() {
        if (!householdName.trim()) {
            error = $t.modals.error_name_required;
            return;
        }
        
        loading = true;
        error = '';
        
        try {
            // 1. Create household
            const { data: household, error: hhError } = await supabase
                .from('households')
                .insert({
                    owner_id: userId,
                    name: householdName.trim(),
                    timezone: householdTimezone,
                    subscription_status: 'free'
                })
                .select()
                .single();
            
            if (hhError) throw hhError;
            
            // 2. Add user as member
            const { error: memberError } = await supabase
                .from('household_members')
                .insert({
                    household_id: household.id,
                    user_id: userId,
                    is_active: true,
                    can_log: true,
                    can_edit: true
                });
            
            if (memberError) throw memberError;
            
            // 3. Dispatch success
            dispatch('created', { household });
            
        } catch (err: any) {
            console.error('Error creating household:', err);
            error = err.message || $t.modals.create_household; // Generic error fallback
        } finally {
            loading = false;
        }
    }
</script>

<div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"></div>
    
    <!-- Modal -->
    <div class="bg-white rounded-[32px] overflow-hidden w-full max-w-sm shadow-2xl relative z-10 animate-scale-in">
        <!-- Header -->
        <div class="h-28 bg-brand-sage flex items-center justify-center relative overflow-hidden">
            <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <div class="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-white text-3xl relative z-10">
                🏠
            </div>
        </div>
        
        <div class="p-6">
            <h2 class="text-2xl font-bold text-gray-900 text-center mb-2">{$t.modals.welcome_title}</h2>
            <p class="text-gray-500 text-center text-sm mb-6">
                {$t.modals.welcome_desc}
            </p>
            
            {#if error}
                <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
                    {error}
                </div>
            {/if}
            
            <div class="mb-6">
                <label for="household-name" class="block text-sm font-medium text-gray-700 mb-2">
                    {$t.modals.enter_household_name}
                </label>
                <input
                    id="household-name"
                    type="text"
                    bind:value={householdName}
                    placeholder={$t.modals.household_placeholder}
                    class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/20 outline-none transition-all text-gray-900 mb-4"
                    disabled={loading}
                />
                
                <label for="household-timezone" class="block text-sm font-medium text-gray-700 mb-2">
                    {$t.settings.timezone || 'Household Timezone'}
                </label>
                <select
                    id="household-timezone"
                    bind:value={householdTimezone}
                    disabled={loading}
                    class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/20 outline-none transition-all text-gray-900 appearance-none"
                    style="background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E'); background-repeat: no-repeat; background-position: right 1rem top 50%; background-size: 0.65rem auto;"
                >
                    {#each timezones as tz}
                        <option value={tz}>{tz}</option>
                    {/each}
                </select>
            </div>
            
            <button
                on:click={createHousehold}
                disabled={loading || !householdName.trim()}
                class="w-full py-4 bg-brand-sage text-white font-bold rounded-xl shadow-lg hover:bg-brand-sage/90 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
                {#if loading}
                    <div class="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                {/if}
                {$t.modals.create_button}
            </button>
        </div>
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
        animation: scale-in 0.2s ease-out;
    }
</style>
