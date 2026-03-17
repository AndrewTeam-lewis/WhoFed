<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { supabase } from '$lib/supabase';
    import { t } from '$lib/services/i18n';

    const dispatch = createEventDispatcher();

    export let currentEmail: string;

    let newEmail = '';
    let loading = false;
    let error = '';
    let success = false;

    async function updateEmail() {
        if (!newEmail) {
            error = $t.change_email.error_enter_email;
            return;
        }
        if (newEmail === currentEmail) {
            error = $t.change_email.error_same_email;
            return;
        }
        if (!newEmail.includes('@') || !newEmail.includes('.')) {
            error = $t.change_email.error_invalid_email;
            return;
        }

        loading = true;
        error = '';

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                email: newEmail
            });

            if (updateError) throw updateError;

            success = true;

        } catch (e: any) {
            console.error('Error updating email:', e);
            error = e.message || $t.change_email.error_update_failed;
        } finally {
            loading = false;
        }
    }
</script>

<div class="fixed inset-0 z-[9999] flex items-center justify-center p-4">
    <!-- Backdrop -->
    <button type="button" class="absolute inset-0 bg-black/50 backdrop-blur-sm" on:click={() => dispatch('close')}></button>

    <!-- Modal -->
    <div class="bg-white rounded-[32px] w-full max-w-sm relative z-10">
        <div class="p-6">
            <!-- Header -->
            <div class="flex items-center justify-between mb-6">
                <h3 class="text-xl font-bold text-gray-900">{$t.change_email.title}</h3>
                <button on:click={() => dispatch('close')} class="text-gray-400 hover:text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {#if success}
                <div class="text-center py-6 space-y-4">
                    <div class="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <div>
                        <h4 class="text-lg font-bold text-gray-900">{$t.change_email.check_inbox}</h4>
                        <p class="text-sm text-gray-500 mt-2 px-4">
                            {$t.change_email.confirmation_sent.replace('{email}', newEmail)}
                        </p>
                    </div>
                    <button 
                        class="px-6 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg text-sm hover:bg-gray-200 transition-colors"
                        on:click={() => dispatch('close')}
                    >
                        {$t.change_email.close}
                    </button>
                </div>
            {:else}
                <div class="space-y-4">
                    <p class="text-sm text-gray-500">
                        {$t.change_email.verification_desc}
                    </p>

                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{$t.change_email.current_email}</label>
                        <input
                            type="text"
                            value={currentEmail}
                            disabled
                            class="w-full p-3 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-500"
                        />
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{$t.change_email.new_email}</label>
                        <input
                            type="email"
                            bind:value={newEmail}
                            placeholder="name@example.com"
                            class="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-sage/20 focus:border-brand-sage"
                        />
                    </div>

                    {#if error}
                        <div class="text-sm p-3 bg-red-50 text-red-600 rounded-lg">
                            {error}
                        </div>
                    {/if}

                    <button
                        class="w-full py-3 bg-brand-sage text-white font-bold rounded-xl shadow-lg shadow-brand-sage/20 active:scale-95 transition-transform disabled:opacity-50"
                        on:click={updateEmail}
                        disabled={!newEmail || loading}
                    >
                        {#if loading}
                            {$t.change_email.sending}
                        {:else}
                            {$t.change_email.send_link}
                        {/if}
                    </button>
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    @keyframes fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    .animate-fade-in {
        animation: fade-in 0.2s ease-out;
    }
</style>
