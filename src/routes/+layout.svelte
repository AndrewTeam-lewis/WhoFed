<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authService } from '$lib/services/auth';
  import { currentUser, currentSession, currentProfile } from '$lib/stores/user';
  import { db } from '$lib/db';
  import { ensureDailyTasks } from '$lib/services/taskService';
  import { supabase } from '$lib/supabase';
  import { availableHouseholds, switchHousehold, getStoredHouseholdId } from '$lib/stores/appState';
  import Walkthrough from '$lib/components/Walkthrough.svelte';
  import HouseholdSetupModal from '$lib/components/HouseholdSetupModal.svelte';
  import '../app.css';

  let showHouseholdSetup = false;
  let setupUserId = '';

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
        
        // Load households
        await loadHouseholds(session.user.id);
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

  async function loadHouseholds(userId: string) {
      const { data: members } = await supabase
          .from('household_members')
          .select(`household_id, households(id, name, subscription_status, owner_id)`)
          .eq('user_id', userId);
      
      // If no household, show setup modal
      if (!members || members.length === 0) {
          setupUserId = userId;
          showHouseholdSetup = true;
          return;
      }
      
      // Get owner names for display
      const ownerIds = members.map(m => m.households?.owner_id).filter(Boolean);
      let ownerNames: Record<string, string> = {};

      if (ownerIds.length > 0) {
          const { data: owners } = await supabase
              .from('profiles')
              .select('id, first_name, last_name')
              .in('id', ownerIds);

          owners?.forEach(o => {
              const fullName = [o.first_name, o.last_name].filter(Boolean).join(' ') || 'Someone';
              ownerNames[o.id] = fullName;
          });
      }

      // Map to State Objects - use actual name or fallback
      const householdsList = members.map(m => {
           const ownerId = m.households?.owner_id;
           const ownerName = ownerNames[ownerId] || 'Unknown';
           const isOwner = ownerId === userId;

           // Use actual name if set, otherwise fallback to owner-based name
           const displayName = m.households?.name
               || (isOwner ? 'My Household' : `${ownerName}'s Household`);

           return {
               id: m.household_id,
               name: displayName,
               role: isOwner ? 'owner' : 'member',
               subscription_status: m.households?.subscription_status,
               ownerName: ownerName
           };
      });
      
      // Update Stores
      availableHouseholds.set(householdsList as any);
      
      // Determine Active
      const storedId = getStoredHouseholdId();
      const preferred = householdsList.find(h => h.id === storedId);
      const initial = preferred || householdsList[0];
      
      switchHousehold(initial as any);
      
      // Ensure tasks for the ACTIVE one
      ensureDailyTasks(initial.id);
  }

  async function handleHouseholdCreated(event: CustomEvent) {
      showHouseholdSetup = false;
      // Reload households after creation
      await loadHouseholds(setupUserId);
  }
</script>

<div class="min-h-screen bg-gray-50">

  <main>
    <slot />
  </main>
  
  <Walkthrough />
  
  {#if showHouseholdSetup}
    <HouseholdSetupModal userId={setupUserId} on:created={handleHouseholdCreated} />
  {/if}
</div>
