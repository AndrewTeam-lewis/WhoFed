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

  onMount(async () => {
    householdId = $page.url.searchParams.get('householdId');
    if (!householdId) {
        error = 'Invalid invite link: No household ID provided.';
        loading = false;
        return;
    }

    // 1. Check Auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        // Show Landing Page instead of auto-redirect
        isGuest = true;
        loading = false;
        return;
    }
    currentUser = session.user;

    // 2. Load Household Info (Only if authenticated)
    await loadHouseholdInfo();
  });

  async function loadHouseholdInfo() {
      let step = 'init';
      try {
        // 2. Fetch Household Info via Secure RPC
        step = 'fetch_rpc';
        const { data: info, error: rpcError } = await supabase
            .rpc('get_household_join_info', { _household_id: householdId })
            .maybeSingle();

        if (rpcError) throw rpcError;
        if (!info) throw new Error('Household not found (invalid ID)');

        ownerName = info.owner_name;
        memberCount = info.member_count;

        // 3. Check if already a member
        step = 'check_membership';
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

    } catch (err: any) {
        console.error('Error loading invite:', err);
        error = `Step ${step}: ${err.message || err.error_description || 'Unknown error'} (${err.code || 'No Code'})`;
    } finally {
        loading = false;
    }
  }

  async function joinHousehold() {
      if (!currentUser || !householdId) return;
      joining = true;
      try {
          const { error: joinError } = await supabase
            .from('household_members')
            .insert({
                household_id: householdId,
                user_id: currentUser.id,
                is_active: true,
                can_log: true,
                can_edit: false
            });

            if (joinError) {
                // Ignore unique constraint violation (already a member)
                if (joinError.code === '23505') {
                    goto('/');
                    return;
                }
                throw joinError;
            }
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
        {:else if isGuest}
            <!-- Guest Landing Page -->
             <div class="py-6">
                <div class="w-20 h-20 bg-brand-sage/10 text-brand-sage rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                </div>

                <h1 class="text-2xl font-bold text-gray-900 mb-2">You've been invited!</h1>
                <p class="text-gray-500 mb-8">
                    Someone invited you to help care for their pets on <span class="font-bold text-brand-sage">WhoFed</span>.
                </p>

                <div class="space-y-3">
                    <button 
                        on:click={() => navigateToAuth('register')}
                        class="w-full py-4 bg-brand-sage text-white font-bold rounded-2xl shadow-lg hover:bg-brand-sage/90 transition-all"
                    >
                        Create Account
                    </button>
                    
                    <button 
                        on:click={() => navigateToAuth('login')}
                        class="w-full py-4 bg-white border-2 border-brand-sage/20 text-brand-sage font-bold rounded-2xl hover:bg-brand-sage/5 transition-all"
                    >
                        Log In
                    </button>
                </div>
                
                <div class="mt-8 pt-6 border-t border-gray-100">
                    <p class="text-xs text-gray-400 uppercase font-bold tracking-wider mb-4">Coming Soon</p>
                    <div class="flex justify-center space-x-4 opacity-50">
                        <div class="h-10 w-32 bg-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-400 font-bold">App Store</div>
                        <div class="h-10 w-32 bg-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-400 font-bold">Google Play</div>
                    </div>
                </div>
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
