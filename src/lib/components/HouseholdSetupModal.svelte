<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { supabase } from '$lib/supabase';
    
    export let userId: string;
    
    const dispatch = createEventDispatcher();
    
    let householdName = '';
    let loading = false;
    let error = '';
    
    async function createHousehold() {
        if (!householdName.trim()) {
            error = 'Please enter a household name';
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
            error = err.message || 'Failed to create household';
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
            <h2 class="text-2xl font-bold text-gray-900 text-center mb-2">Welcome to WhoFed!</h2>
            <p class="text-gray-500 text-center text-sm mb-6">
                Let's set up your household to start tracking pet care.
            </p>
            
            {#if error}
                <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
                    {error}
                </div>
            {/if}
            
            <div class="mb-6">
                <label for="household-name" class="block text-sm font-medium text-gray-700 mb-2">
                    Name your household
                </label>
                <input
                    id="household-name"
                    type="text"
                    bind:value={householdName}
                    placeholder="e.g. The Smith Family, Home, etc."
                    class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/20 outline-none transition-all text-gray-900"
                    disabled={loading}
                />
            </div>
            
            <button
                on:click={createHousehold}
                disabled={loading || !householdName.trim()}
                class="w-full py-4 bg-brand-sage text-white font-bold rounded-xl shadow-lg hover:bg-brand-sage/90 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
                {#if loading}
                    <div class="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                {/if}
                Create Household
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
