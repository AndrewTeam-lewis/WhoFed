<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { supabase } from '$lib/supabase';
    import { t } from '$lib/services/i18n';

    const dispatch = createEventDispatcher();

    let name = '';
    let loading = false;
    let error = '';

    async function handleSubmit() {
        if (!name.trim()) return;
        loading = true;
        error = '';

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // 1. Create Household
            const { data: household, error: hhError } = await supabase
                .from('households')
                .insert({
                    owner_id: user.id,
                    name: name.trim(),
                    subscription_status: 'free'
                })
                .select()
                .single();

            if (hhError) throw hhError;

            // 2. Add Member (Self)
            const { error: memberError } = await supabase
                .from('household_members')
                .insert({
                    household_id: household.id,
                    user_id: user.id,
                    is_active: true,
                    can_log: true,
                    can_edit: true
                });

            if (memberError) throw memberError;

            dispatch('create', { household });

        } catch (e: any) {
            console.error('Error creating household:', e);
            error = e.message || $t.common.error;
        } finally {
            loading = false;
        }
    }
</script>

<div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <!-- Backdrop -->
    <button type="button" class="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" on:click={() => dispatch('close')}></button>

    <!-- Modal -->
    <div class="bg-white rounded-[32px] w-full max-w-sm relative z-10 animate-scale-in">
        <div class="p-6">
            <!-- Header -->
            <div class="flex items-center justify-between mb-6">
                <h3 class="text-xl font-bold text-gray-900">{$t.modals.create_household}</h3>
                <button on:click={() => dispatch('close')} class="text-gray-400 hover:text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div class="space-y-4">
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{$t.modals.household_name}</label>
                    <input
                        type="text"
                        bind:value={name}
                        placeholder={$t.modals.household_placeholder}
                        class="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-sage/20 focus:border-brand-sage"
                        on:keydown={(e) => e.key === 'Enter' && handleSubmit()}
                    />
                </div>

                {#if error}
                    <div class="text-sm p-3 bg-red-50 text-red-600 rounded-lg">
                        {error}
                    </div>
                {/if}

                <button
                    class="w-full py-3 bg-brand-sage text-white font-bold rounded-xl shadow-lg shadow-brand-sage/20 active:scale-95 transition-transform disabled:opacity-50"
                    on:click={handleSubmit}
                    disabled={!name.trim() || loading}
                >
                    {#if loading}
                        {$t.modals.sending}
                    {:else}
                        {$t.modals.create_button}
                    {/if}
                </button>
            </div>
        </div>
    </div>
</div>
