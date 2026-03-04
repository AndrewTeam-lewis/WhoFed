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
        // Password reset flow - redirect to reset password page
        goto('/auth/reset-password');
        return;
      }

      // Get current session after OAuth redirect
      const session = await authService.getSession();

      if (session?.user) {
        // Check if profile exists
        const profile = await authService.getProfile(session.user.id);

        if (profile) {
          // Profile exists, go to profile page
          goto('/app');
        } else {
          // No profile, need to complete profile
          goto('/auth/complete-profile');
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
