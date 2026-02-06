<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authService } from '$lib/services/auth';
  import { currentUser, currentSession, currentProfile } from '$lib/stores/user';
  import { db } from '$lib/db';
  import { ensureDailyTasks } from '$lib/services/taskService';
  import { supabase } from '$lib/supabase';
  import { availableHouseholds, switchHousehold, getStoredHouseholdId } from '$lib/stores/appState';
  import { purchasesService } from '$lib/services/purchases';
  import Walkthrough from '$lib/components/Walkthrough.svelte';
  import HouseholdSetupModal from '$lib/components/HouseholdSetupModal.svelte';
  import '../app.css';

  let showHouseholdSetup = false;
  let setupUserId = '';

  // Reactively sync RevenueCat user
  $: if ($currentUser) {
      purchasesService.login($currentUser.id);
  } else {
      purchasesService.logout(); // Clears native entitlement store
  }

  onMount(async () => {
    // Initialize RevenueCat
    purchasesService.init();

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
      // Optimized Query: Get members + households + owner profile in ONE go
      const { data: members, error } = await supabase
          .from('household_members')
          .select(`
              household_id, 
              households (
                  id, 
                  name, 
                  subscription_status, 
                  owner_id,
                  profiles:owner_id (first_name, last_name)
              )
          `)
          .eq('user_id', userId);
      
      if (error) {
          console.error('Error loading households:', error);
          return;
      }

      // If no household, show setup modal
      if (!members || members.length === 0) {
          setupUserId = userId;
          showHouseholdSetup = true;
          return;
      }
      
      // Map to State Objects
      const householdsList = members.map(m => {
           const hh = m.households as any;
           const ownerId = hh?.owner_id;
           const ownerProfile = hh?.profiles; // Joined data
           const ownerName = ownerProfile 
               ? [ownerProfile.first_name, ownerProfile.last_name].filter(Boolean).join(' ') 
               : 'Unknown';

           const isOwner = ownerId === userId;

           // Use actual name if set, otherwise fallback to owner-based name
           const displayName = hh?.name
               || (isOwner ? 'My Household' : `${ownerName}'s Household`);

           return {
               id: m.household_id,
               name: displayName,
               role: isOwner ? 'owner' : 'member',
               subscription_status: hh?.subscription_status,
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
