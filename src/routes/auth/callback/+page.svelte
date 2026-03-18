<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authService } from '$lib/services/auth';
  import { currentUser } from '$lib/stores/user';

  let loading = true;

  onMount(async () => {
    try {
      // Check if this is a password recovery callback
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get('type');

      if (type === 'recovery') {
        goto('/auth/reset-password');
        return;
      }

      // Retrieve any pending redirect stored before OAuth flow (e.g., invite link)
      const pendingRedirect = localStorage.getItem('whofed_oauth_redirect');
      localStorage.removeItem('whofed_oauth_redirect');

      // Get current session after OAuth redirect
      const session = await authService.getSession();

      if (session?.user) {
        // Check if profile exists
        const profile = await authService.getProfile(session.user.id);

        if (profile && profile.first_name) {
          // Profile exists with name set - honor pending redirect (e.g., /join page) or go to /app
          goto(pendingRedirect ? decodeURIComponent(pendingRedirect) : '/app');
        } else {
          // No profile or missing first_name, need to complete profile
          // Pass pending redirect so complete-profile can forward after setup
          const completeProfileUrl = pendingRedirect
            ? `/auth/complete-profile?redirectTo=${encodeURIComponent(pendingRedirect)}`
            : '/auth/complete-profile';
          goto(completeProfileUrl);
        }
      } else {
        // No session, redirect to login
        goto('/auth/login');
      }
    } catch (error) {
      console.error('OAuth callback error:', error);
      goto('/auth/login');
    }
  });
</script>

<div class="max-w-md mx-auto mt-20 text-center">
  <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
  <p class="mt-4 text-gray-600">Completing sign in...</p>
</div>
