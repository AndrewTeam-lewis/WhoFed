<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authService } from '$lib/services/auth';
  import { currentUser, currentSession, currentProfile } from '$lib/stores/user';
  import { db } from '$lib/db';
  import { ensureDailyTasks } from '$lib/services/taskService';
  import { supabase } from '$lib/supabase';
  import Walkthrough from '$lib/components/Walkthrough.svelte';
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
        
        // Check/Generate Tasks for Today (Option A)
        // We need household_id. Profile might have it? Or fetching it.
        // Let's quickly fetch household_id if not on profile type.
        // Actually, household_members table links user to household.
        const { data: members } = await supabase
            .from('household_members')
            .select('household_id')
            .eq('user_id', session.user.id)
            .limit(1);
            
        if (members && members.length > 0) {
            ensureDailyTasks(members[0].household_id);
        }
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


  <main>
    <slot />
  </main>
  
  <Walkthrough />
</div>
