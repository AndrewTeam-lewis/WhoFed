<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { supabase } from '$lib/supabase';
    import LandingPage from '$lib/components/LandingPage.svelte';

    let loading = true;

    onMount(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            goto('/app');
        } else {
            loading = false;
        }
    });
</script>

{#if loading}
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-sage"></div>
    </div>
{:else}
    <LandingPage />
{/if}
