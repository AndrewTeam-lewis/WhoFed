<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { App } from '@capacitor/app';
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
      console.log('[DEBUG REACTIVE] currentUser changed, calling purchasesService.login()');
      purchasesService.login($currentUser.id);
  } else {
      console.log('[DEBUG REACTIVE] currentUser cleared, calling purchasesService.logout()');
      purchasesService.logout(); // Clears native entitlement store
  }

  onMount(async () => {
    console.log('[DEBUG] === Layout onMount START ===');
    console.time('[DEBUG] Total onMount time');

    // Initialize RevenueCat
    console.log('[DEBUG] Step 1: Calling purchasesService.init()...');
    purchasesService.init();
    console.log('[DEBUG] Step 1: purchasesService.init() called (runs in background)');

    // Check for existing session
    console.log('[DEBUG] Step 2: Getting session...');
    console.time('[DEBUG] getSession');
    const session = await authService.getSession();
    console.timeEnd('[DEBUG] getSession');
    console.log('[DEBUG] Step 2: Session result:', session?.user?.id ? 'User found' : 'No user');

    if (session?.user) {
      console.log('[DEBUG] Step 3: Setting currentSession and currentUser stores...');
      currentSession.set(session);
      currentUser.set(session.user);
      console.log('[DEBUG] Step 3: Stores set (this triggers reactive statement)');

      // Load profile
      console.log('[DEBUG] Step 4: Loading profile for user:', session.user.id);
      console.time('[DEBUG] getProfile');
      const profile = await authService.getProfile(session.user.id);
      console.timeEnd('[DEBUG] getProfile');
      console.log('[DEBUG] Step 4: Profile result:', profile ? 'Found' : 'Not found');

      if (profile) {
        console.log('[DEBUG] Step 5: Setting currentProfile store...');
        currentProfile.set(profile);

        // Cache profile locally for offline access
        console.log('[DEBUG] Step 6: Caching profile to Dexie...');
        console.time('[DEBUG] Dexie put');
        await db.profiles.put(profile);
        console.timeEnd('[DEBUG] Dexie put');
        console.log('[DEBUG] Step 6: Profile cached');

        // Load households
        console.log('[DEBUG] Step 7: Loading households...');
        console.time('[DEBUG] loadHouseholds TOTAL');
        await loadHouseholds(session.user.id);
        console.timeEnd('[DEBUG] loadHouseholds TOTAL');
        console.log('[DEBUG] Step 7: Households loaded');
      }
    } else {
      console.log('[DEBUG] No session, trying cached profiles...');
      // Try to load from local cache for offline access
      const cachedProfiles = await db.profiles.toArray();
      if (cachedProfiles.length > 0) {
        currentProfile.set(cachedProfiles[0]);
        console.log('[DEBUG] Loaded cached profile');
      }
    }

    console.timeEnd('[DEBUG] Total onMount time');
    console.log('[DEBUG] === Layout onMount END ===');

    // Listen to auth state changes
    const { data: authListener } = authService.onAuthStateChange(async (session) => {
      console.log('[DEBUG AUTH LISTENER] Auth state changed, session:', session?.user?.id ? 'User found' : 'No user');
      currentSession.set(session);
      currentUser.set(session?.user || null);

      if (session?.user) {
        console.log('[DEBUG AUTH LISTENER] Loading profile and households...');
        const profile = await authService.getProfile(session.user.id);
        if (profile) {
          currentProfile.set(profile);
          await db.profiles.put(profile);

          // Load households if not already loaded
          console.log('[DEBUG AUTH LISTENER] Calling loadHouseholds...');
          await loadHouseholds(session.user.id);
        }
      } else {
        currentProfile.set(null);
      }
    });

    // Listen for deep links (OAuth redirects)
    const appUrlListener = await App.addListener('appUrlOpen', async (event) => {
        console.log('[DEBUG DEEP LINK] App opened with URL:', event.url);
        
        // Check if it's our auth callback scheme
        if (event.url.includes('google-auth')) {
            // Extract hash
            const hashIndex = event.url.indexOf('#');
            if (hashIndex !== -1) {
                const hash = event.url.substring(hashIndex + 1);
                const params = new URLSearchParams(hash);
                
                const access_token = params.get('access_token');
                const refresh_token = params.get('refresh_token');

                if (access_token && refresh_token) {
                    console.log('[DEBUG DEEP LINK] Found tokens, setting session...');
                    const { error } = await supabase.auth.setSession({
                        access_token,
                        refresh_token
                    });

                    if (error) {
                        console.error('[DEBUG DEEP LINK] Error setting session:', error);
                    } else {
                        console.log('[DEBUG DEEP LINK] Session set successfully');
                        // No need to navigate manually, auth listener will pick it up
                        goto('/app');
                    }
                }
            }
        }
    });

    // Cleanup listener on unmount
    return () => {
      authListener?.subscription.unsubscribe();
      appUrlListener.remove();
    };
  });

  async function loadHouseholds(userId: string) {
      console.log('[DEBUG loadHouseholds] START for userId:', userId);

      // Optimized Query: Get members + households + owner profile in ONE go
      console.log('[DEBUG loadHouseholds] Executing Supabase query...');
      console.time('[DEBUG loadHouseholds] Supabase query');
      const { data: members, error } = await supabase
          .from('household_members')
          .select(`
              household_id,
              households (
                  id,
                  name,
                  subscription_status,
                  owner_id,
                  profiles:owner_id (first_name)
              )
          `)
          .eq('user_id', userId);
      console.timeEnd('[DEBUG loadHouseholds] Supabase query');
      console.log('[DEBUG loadHouseholds] Query complete. Data:', members, 'Error:', error);

      if (error) {
          console.error('[DEBUG loadHouseholds] ERROR loading households:', error);
          return;
      }

      // If no household, show setup modal
      if (!members || members.length === 0) {
          console.log('[DEBUG loadHouseholds] No households found, showing setup modal');
          setupUserId = userId;
          showHouseholdSetup = true;
          return;
      }

      console.log('[DEBUG loadHouseholds] Found', members.length, 'household(s), mapping...');

      // Map to State Objects
      const householdsList = members.map(m => {
           const hh = m.households as any;
           const ownerId = hh?.owner_id;
           const ownerProfile = hh?.profiles; // Joined data
           const ownerName = ownerProfile?.first_name || 'Unknown';

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
      console.log('[DEBUG loadHouseholds] Mapped households:', householdsList);

      // Update Stores
      console.log('[DEBUG loadHouseholds] Setting availableHouseholds store...');
      availableHouseholds.set(householdsList as any);

      // Determine Active
      console.log('[DEBUG loadHouseholds] Determining active household...');
      const storedId = getStoredHouseholdId();
      console.log('[DEBUG loadHouseholds] Stored household ID from localStorage:', storedId);
      const preferred = householdsList.find(h => h.id === storedId);
      const initial = preferred || householdsList[0];
      console.log('[DEBUG loadHouseholds] Selected household:', initial.name, initial.id);

      console.log('[DEBUG loadHouseholds] Calling switchHousehold...');
      switchHousehold(initial as any);
      console.log('[DEBUG loadHouseholds] activeHousehold store set');

      // Ensure tasks for the ACTIVE one
      console.log('[DEBUG loadHouseholds] Calling ensureDailyTasks (background)...');
      ensureDailyTasks(initial.id);
      console.log('[DEBUG loadHouseholds] END');
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
