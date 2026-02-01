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
        // Refactored for Multi-Household Support
        const { data: members, error: memError } = await supabase
        .from('household_members')
        .select(`household_id, households(id, subscription_status, owner_id)`)
        .eq('user_id', session.user.id);
            
        if (members && members.length > 0) {
            // 1. Get formatting data (Owner Names)
            const ownerIds = members.map(m => m.households?.owner_id).filter(Boolean);
            let ownerNames: Record<string, string> = {};
            
            if (ownerIds.length > 0) {
                const { data: owners } = await supabase
                    .from('profiles')
                    .select('id, first_name')
                    .in('id', ownerIds);
                    
                owners?.forEach(o => {
                    ownerNames[o.id] = o.first_name || 'Someone';
                });
            }

            // 2. Map to State Objects
            const householdsList = members.map(m => {
                 const ownerId = m.households?.owner_id;
                 const ownerName = ownerNames[ownerId] || 'Unknown';
                 // If I am owner, say "My Household", else "[Name]'s Household"
                 const displayName = (ownerId === session.user.id) 
                    ? 'My Household' 
                    : `${ownerName}'s Household`;

                 return {
                     id: m.household_id,
                     name: displayName,
                     role: (ownerId === session.user.id) ? 'owner' : 'member',
                     subscription_status: m.households?.subscription_status
                 };
            });
            
            // 3. Update Stores
            availableHouseholds.set(householdsList as any);
            
            // 4. Determine Active
            const storedId = getStoredHouseholdId();
            const preferred = householdsList.find(h => h.id === storedId);
            const initial = preferred || householdsList[0];
            
            switchHousehold(initial as any);
            
            // 5. Ensure tasks for the ACTIVE one
            ensureDailyTasks(initial.id);
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
