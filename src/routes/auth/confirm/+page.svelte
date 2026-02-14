<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authService } from '$lib/services/auth';

  onMount(async () => {
    // 1. Immediately kill the session Supabase just started
    try {
        await authService.logout();
    } catch (e) {
        console.error('Logout failed during confirmation cleanup:', e);
    }
    
    // 2. Clear local storage to be 100% sure
    localStorage.clear();
    
    // 3. Send them back to login with a success message
    goto('/auth/login?message=Email confirmed! Please log in.');
  });
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50">
  <div class="text-center">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-sage mx-auto mb-4"></div>
    <p class="text-gray-600">Verifying your change...</p>
  </div>
</div>
