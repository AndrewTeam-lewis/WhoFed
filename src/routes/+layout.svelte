<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authService } from '$lib/services/auth';
  import { currentUser, currentSession, currentProfile } from '$lib/stores/user';
  import { db } from '$lib/db';
  import '../app.css';

  onMount(async () => {
    // Check for existing session
    const session = await authService.getSession();
    
    if (session?.user) {
      currentSession.set(session);
      currentUser.set(session.user);
      
      // Load profile
      const profile = await authService.getProfile(session.user.id);
      if (profile) {
        currentProfile.set(profile);
        // Cache profile locally for offline access
        await db.profiles.put(profile);
      }
    } else {
      // Try to load from local cache for offline access
      const cachedProfiles = await db.profiles.toArray();
      if (cachedProfiles.length > 0) {
        currentProfile.set(cachedProfiles[0]);
      }
    }

    // Listen to auth state changes
    const { data: authListener } = authService.onAuthStateChange(async (session) => {
      currentSession.set(session);
      currentUser.set(session?.user || null);
      
      if (session?.user) {
        const profile = await authService.getProfile(session.user.id);
        if (profile) {
          currentProfile.set(profile);
          await db.profiles.put(profile);
        }
      } else {
        currentProfile.set(null);
      }
    });

    // Cleanup listener on unmount
    return () => {
      authListener?.subscription.unsubscribe();
    };
  });
</script>

<div class="min-h-screen bg-gray-50">
  <nav class="bg-white shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16 items-center">
        <a href="/" class="text-xl font-bold text-indigo-600">Na Régua</a>
        
        <div class="flex gap-4">
          {#if $currentUser}
            <a href="/profile" class="text-gray-700 hover:text-indigo-600">Profile</a>
          {:else}
            <a href="/login" class="text-gray-700 hover:text-indigo-600">Login</a>
            <a href="/register" class="text-indigo-600 hover:text-indigo-800 font-medium">Register</a>
          {/if}
        </div>
      </div>
    </div>
  </nav>

  <main>
    <slot />
  </main>
</div>
