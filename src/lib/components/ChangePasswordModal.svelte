<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { supabase } from '$lib/supabase';

    const dispatch = createEventDispatcher();

    let password = '';
    let confirmPassword = '';
    let loading = false;
    let error = '';
    let success = false;

    onMount(() => {
        console.log('ChangePasswordModal mounted correctly');
    });

    async function updatePassword() {
        if (!password || !confirmPassword) {
            error = 'Please fill in all fields';
            return;
        }
        if (password !== confirmPassword) {
            error = 'Passwords do not match';
            return;
        }
        if (password.length < 6) {
            error = 'Password must be at least 6 characters';
            return;
        }

        loading = true;
        error = '';

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password
            });

            if (updateError) throw updateError;

            success = true;
            setTimeout(() => {
                dispatch('close');
            }, 2000); // Close after showing success message

        } catch (e: any) {
            console.error('Error updating password:', e);
            error = e.message || 'Failed to update password';
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
                <h3 class="text-xl font-bold text-gray-900">Change Password</h3>
                <button on:click={() => dispatch('close')} class="text-gray-400 hover:text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {#if success}
                <div class="text-center py-8">
                    <div class="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h4 class="text-lg font-bold text-gray-900 mb-2">Password Updated!</h4>
                    <p class="text-sm text-gray-500">Your password has been changed successfully.</p>
                </div>
            {:else}
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">New Password</label>
                        <input
                            type="password"
                            bind:value={password}
                            placeholder="Min. 6 characters"
                            class="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-sage/20 focus:border-brand-sage"
                        />
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Confirm Password</label>
                        <input
                            type="password"
                            bind:value={confirmPassword}
                            placeholder="Re-enter password"
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
                        on:click={updatePassword}
                        disabled={!password || !confirmPassword || loading}
                    >
                        {#if loading}
                            Update...
                        {:else}
                            Update Password
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
