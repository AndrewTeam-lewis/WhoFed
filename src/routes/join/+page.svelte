<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';

  let loading = true;
  let joining = false;
  let error = '';
  let householdId: string | null = null;
  let householdName = '';
  let ownerName = '';
  let memberCount = 0;
  let currentUser: any = null;

  // State for unauthenticated users
  let isGuest = false;
  let showAppDownload = false;
  let attemptedDeepLink = false;

  onMount(async () => {
    // householdId check moved to loadHouseholdInfo to support key-based join
    // if (!householdId) ...

    // 1. Check Auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        // Guest user - try to open app first
        isGuest = true;
        attemptDeepLink();
        return;
    }
    currentUser = session.user;

    // 2. Load Household Info (Only if authenticated)
    await loadHouseholdInfo();
  });

  function attemptDeepLink() {
    const key = $page.url.searchParams.get('k');
    if (!key) {
      // No key, just show the guest page
      loading = false;
      return;
    }

    console.log('[Join] Attempting to open app with deep link...');
    attemptedDeepLink = true;

    // Try to open the mobile app
    const deepLinkUrl = `whofed://join?k=${key}`;
    window.location.href = deepLinkUrl;

    // Wait 2.5 seconds to see if user left the page (app opened)
    setTimeout(() => {
      // If we're still here, the app didn't open
      console.log('[Join] App did not open, showing download page');
      showAppDownload = true;
      loading = false;
    }, 2500);
  }

  async function loadHouseholdInfo() {
      let step = 'init';
      try {
        const key = $page.url.searchParams.get('k');
        
        let info: any = null;

        if (key) {
            // Path A: Resolve via Key (RPC)
            step = 'resolve_key';
            const { data, error: keyError } = await supabase
                .rpc('get_household_from_key', { lookup_key: key })
                .maybeSingle();
            
            if (keyError) throw keyError;
            if (!data) throw new Error('Invalid or expired invite link.');
            
            info = data;
            householdId = data.household_id; // Set the ID for the join step
        } else if (householdId) {
            // Path B: Legacy/Direct ID (RPC)
            step = 'fetch_rpc';
            const { data, error: rpcError } = await supabase
                .rpc('get_household_join_info', { _household_id: householdId })
                .maybeSingle();

            if (rpcError) throw rpcError;
            if (!data) throw new Error('Household not found (invalid ID)');
            info = data;
        } else {
             throw new Error('Invalid link: Missing key or ID.');
        }

        ownerName = info.owner_name;
        memberCount = info.member_count;

        // 3. Check if already a member
        step = 'check_membership';
        if (currentUser && householdId) {
            const { data: existingMember } = await supabase
                .from('household_members')
                .select('user_id')
                .eq('household_id', householdId)
                .eq('user_id', currentUser.id)
                .maybeSingle();

            if (existingMember) {
                goto('/');
                return;
            }
        }

    } catch (err: any) {
        console.error('Error loading invite:', err);
        error = err.message || 'Unknown error';
    } finally {
        loading = false;
    }
  }

  async function joinHousehold() {
      if (!currentUser || !householdId) return;
      joining = true;
      try {
          const { data, error: joinError } = await supabase.rpc('join_household_by_key', {
              p_household_id: householdId
          });

          if (joinError) throw joinError;

          const result = data as { success: boolean; already_member?: boolean; error?: string };
          if (!result.success) throw new Error(result.error || 'Failed to join household');

          goto('/');

      } catch (err: any) {
          console.error('Error joining:', err);
          error = err.message || 'Failed to join household.';
      } finally {
          joining = false;
      }
  }

  function navigateToAuth(mode: 'login' | 'register') {
      const returnUrl = encodeURIComponent($page.url.pathname + $page.url.search);
      goto(`/auth/${mode}?redirectTo=${returnUrl}`);
  }
</script>

<svelte:head>
  <title>Join Household - WhoFed</title>
</svelte:head>

<div class="min-h-screen bg-brand-sage/5 flex flex-col items-center justify-center p-6">
    <div class="bg-white rounded-[32px] p-8 w-full max-w-sm shadow-xl text-center">
        {#if loading}
            <div class="py-12 flex flex-col items-center">
                 <div class="animate-spin h-10 w-10 border-4 border-brand-sage rounded-full border-t-transparent mb-4"></div>
                 <p class="text-gray-500 font-bold">Loading invite...</p>
            </div>
        {:else if error}
            <div class="py-6">
                <!-- Error UI -->
                <div class="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h2 class="text-xl font-bold text-gray-900 mb-2">Oops!</h2>
                <p class="text-gray-500 mb-6">{error}</p>
                <button on:click={() => goto('/')} class="text-brand-sage font-bold hover:underline">Go Home</button>
            </div>
        {:else if isGuest && showAppDownload}
            <!-- App Download Page (shown when deep link fails) -->
            <div class="py-6">
                <div class="w-20 h-20 bg-brand-sage/10 text-brand-sage rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                </div>

                <h1 class="text-2xl font-bold text-gray-900 mb-2">Download WhoFed</h1>
                <p class="text-gray-500 mb-2">
                    You've been invited to help care for pets on <span class="font-bold text-brand-sage">WhoFed</span>.
                </p>
                <p class="text-sm text-gray-400 mb-8">
                    Download the mobile app to get push notifications and the full experience.
                </p>

                <div class="space-y-3 mb-6">
                    <a
                        href="https://apps.apple.com/app/whofed"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="w-full py-4 px-6 bg-black text-white font-bold rounded-2xl shadow-lg hover:bg-gray-900 transition-all flex items-center justify-center gap-3"
                    >
                        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                        </svg>
                        <span>Download on App Store</span>
                    </a>

                    <a
                        href="https://play.google.com/store/apps/details?id=com.whofed.me"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="w-full py-4 px-6 bg-[#01875f] text-white font-bold rounded-2xl shadow-lg hover:bg-[#017a56] transition-all flex items-center justify-center gap-3"
                    >
                        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                        </svg>
                        <span>Get it on Google Play</span>
                    </a>
                </div>

                <div class="pt-6 border-t border-gray-100">
                    <p class="text-xs text-gray-500 mb-3 text-center">Or continue on web</p>
                    <div class="space-y-2">
                        <button
                            on:click={() => navigateToAuth('register')}
                            class="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all text-sm"
                        >
                            Create Web Account
                        </button>

                        <button
                            on:click={() => navigateToAuth('login')}
                            class="w-full py-3 text-gray-500 font-semibold hover:text-gray-700 transition-all text-sm"
                        >
                            Log In on Web
                        </button>
                    </div>
                </div>
            </div>
        {:else if isGuest}
            <!-- Loading state while attempting deep link -->
            <div class="py-12 flex flex-col items-center">
                <div class="animate-spin h-10 w-10 border-4 border-brand-sage rounded-full border-t-transparent mb-4"></div>
                <p class="text-gray-500 font-bold">Opening app...</p>
            </div>
        {:else}
            <!-- Authenticated Join UI -->
            <div class="py-6">
                <div class="w-20 h-20 bg-brand-sage/10 text-brand-sage rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                </div>

                <h1 class="text-2xl font-bold text-gray-900 mb-2">Join Household?</h1>
                <p class="text-gray-500 mb-8">
                    You've been invited to join 
                    <span class="font-bold text-gray-900">{ownerName}'s</span> 
                    household with {memberCount} other member{memberCount !== 1 ? 's' : ''}.
                </p>

                <button 
                    on:click={joinHousehold} 
                    disabled={joining}
                    class="w-full py-4 bg-brand-sage text-white font-bold rounded-2xl shadow-lg hover:bg-brand-sage/90 transition-all flex items-center justify-center disabled:opacity-70"
                >
                    {#if joining}
                        <div class="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                    {/if}
                    Join Now
                </button>
                
                <button on:click={() => goto('/')} class="mt-6 text-sm text-gray-400 font-bold hover:text-gray-600">Cancel</button>
            </div>
        {/if}
    </div>
</div>
