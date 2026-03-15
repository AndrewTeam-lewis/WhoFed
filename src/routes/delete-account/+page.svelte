<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { supabase } from '$lib/supabase';
    import { currentUser } from '$lib/stores/user';
    import { fade, scale } from 'svelte/transition';
    import { t } from '$lib/services/i18n';

    let loading = true;
    let deleting = false;
    let showGoodbyeModal = false;
    let error = '';

    onMount(async () => {
        // Wait briefly for stores to initialize
        setTimeout(() => {
            if (!$currentUser) {
                // If not logged in, redirect to login page, appending the current path as a return_to parameter if desired,
                // but for simplicity, we just send to login.
                goto('/auth/login?return_to=/delete-account');
            }
            loading = false;
        }, 500);
    });

    async function handleDelete() {
        if (!confirm("Are you absolutely sure? This cannot be undone.")) return;
        
        deleting = true;
        error = '';
        
        try {
            const { error: dbError } = await supabase.rpc('delete_user');
            if (dbError) throw dbError;
            
            await supabase.auth.signOut();
            showGoodbyeModal = true;
        } catch (err: any) {
            console.error('Error deleting account:', err);
            error = err.message || 'Failed to delete account. Please try again or contact support.';
            deleting = false;
        }
    }
</script>

<svelte:head>
    <title>Delete Account | WhoFed</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
        <!-- Logo -->
        <div class="flex justify-center flex-col items-center mb-8">
            <div class="w-24 h-24 mb-4">
                <img src="/whofed_logo.png" alt="WhoFed Logo" class="w-full h-full object-contain" />
            </div>
            <h2 class="text-center text-3xl font-extrabold text-gray-900">
                WhoFed
            </h2>
        </div>
    </div>

    <div class="sm:mx-auto sm:w-full sm:max-w-md">
        {#if loading}
            <!-- Loading State -->
            <div class="bg-white py-8 px-4 shadow sm:rounded-3xl sm:px-10 text-center flex flex-col items-center justify-center" in:fade>
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-sage mb-4"></div>
                <p class="text-gray-500">Checking authentication...</p>
            </div>
        {:else if !$currentUser}
            <!-- Fallback if redirect fails -->
            <div class="bg-white py-8 px-4 shadow sm:rounded-3xl sm:px-10 text-center" in:fade>
                <h3 class="text-xl font-bold text-gray-900 mb-4">Authentication Required</h3>
                <p class="text-gray-600 mb-6">You must be logged in to delete your account data.</p>
                <a href="/auth/login?return_to=/delete-account" class="inline-flex justify-center w-full py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-brand-sage hover:bg-brand-sage/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-sage">
                    Log In
                </a>
            </div>
        {:else}
            <!-- Delete Account Form -->
            <div class="bg-white overflow-hidden shadow sm:rounded-3xl relative" in:scale={{start: 0.95, duration: 200}}>
                <!-- Header Image/Pattern -->
                <div class="h-24 bg-red-50 flex items-center justify-center relative overflow-hidden">
                    <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                    <!-- Warning Icon -->
                    <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-500 shadow-sm relative z-10">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                </div>
                
                <div class="p-8 text-center bg-white">
                    <h3 class="text-2xl font-bold text-gray-900 mb-2">Delete Account?</h3>
                    <p class="text-gray-600 mb-6 text-sm leading-relaxed">
                        You are logged in as <span class="font-bold">{$currentUser.email}</span>.
                        This action is <span class="font-bold text-red-600">permanent</span> and cannot be undone.<br><br>All your pets, logs, households, and user data will be erased immediately.
                    </p>
                    
                    {#if error}
                        <div class="mb-6 p-4 bg-red-50 text-red-600 text-sm rounded-xl text-left border border-red-100">
                            {error}
                        </div>
                    {/if}

                    <div class="space-y-3">
                        <button 
                            class="w-full py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg hover:bg-red-700 transition-all transform hover:scale-[1.02] active:scale-95 disabled:scale-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            on:click={handleDelete}
                            disabled={deleting}
                        >
                            {#if deleting}
                                <span class="flex items-center justify-center">
                                    <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Deleting Data...
                                </span>
                            {:else}
                                Yes, Delete Everything
                            {/if}
                        </button>
                        <a 
                            href="/app"
                            class="block w-full py-3 text-gray-600 font-medium text-sm hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200"
                        >
                            Cancel, Go to Dashboard
                        </a>
                    </div>
                </div>
            </div>
        {/if}
    </div>
</div>

<!-- GOODBYE MODAL -->
{#if showGoodbyeModal}
<div class="fixed inset-0 z-[120] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-gray-900/80 backdrop-blur-sm" in:fade></div>
    
    <div class="bg-white rounded-[32px] overflow-hidden w-full max-w-sm shadow-2xl relative z-10 text-center p-8" in:scale>
        <div class="w-20 h-20 bg-brand-sage/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <span class="text-4xl pr-1">🐾</span>
        </div>
        
        <h3 class="text-2xl font-black text-gray-900 mb-3">Account Deleted</h3>
        <p class="text-gray-500 mb-8 text-sm leading-relaxed">
            Your account and all associated data have been permanently removed. We're sorry to see you go!
        </p>
        
        <a 
            href="/auth/login"
            class="block w-full py-4 bg-brand-sage text-white font-bold rounded-xl shadow-lg hover:bg-brand-sage/90 transition-all"
        >
            Back to Login
        </a>
    </div>
</div>
{/if}
