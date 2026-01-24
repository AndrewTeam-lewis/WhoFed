<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import type { Database } from '$lib/database.types';

  type MemberProfile = {
      user_id: string;
      role: 'owner' | 'member'; // derived
      first_name: string | null;
      email: string | null;
      can_log: boolean;
      can_edit: boolean;
      is_active: boolean;
  };

  let loading = true;
  let members: MemberProfile[] = [];
  let currentUser: any = null;
  let householdId: string | null = null;
  let isOwner = false;

  // Invite state
  let showInviteModal = false;
  let inviteEmail = '';

  onMount(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      goto('/auth/login');
      return;
    }
    currentUser = session.user;

    await loadSettings();
  });

  async function loadSettings() {
    loading = true;
    try {
        // 1. Get my membership to find household
        const { data: myMember, error: myError } = await supabase
            .from('household_members')
            .select('household_id')
            .eq('user_id', currentUser.id)
            .single();
            
        if (myError) throw myError;
        householdId = myMember.household_id;

        // 2. Check if I am owner
        const { data: household, error: hhError } = await supabase
            .from('households')
            .select('owner_id')
            .eq('id', householdId)
            .single();
            
        if (hhError) throw hhError;
        isOwner = household.owner_id === currentUser.id;

        // 3. Get all members
        const { data: memberData, error: memberError } = await supabase
            .from('household_members')
            .select(`
                user_id,
                can_log,
                can_edit,
                is_active,
                profiles (first_name, email)
            `)
            .eq('household_id', householdId);

        if (memberError) throw memberError;

        members = (memberData || []).map((m: any) => ({
            user_id: m.user_id,
            role: m.user_id === household.owner_id ? 'owner' : 'member',
            first_name: m.profiles?.first_name || 'Unknown',
            email: m.profiles?.email || '',
            can_log: m.can_log,
            can_edit: m.can_edit,
            is_active: m.is_active
        }));

    } catch (error) {
        console.error('Error loading settings:', error);
        // alert('Failed to load settings');
    } finally {
        loading = false;
    }
  }

  async function togglePermission(userId: string, permission: 'can_log' | 'can_edit') {
      if (!isOwner) return; // Only owner can change permissions
      
      const member = members.find(m => m.user_id === userId);
      if (!member) return;

      const newValue = !member[permission];

      try {
          const { error } = await supabase
            .from('household_members')
            .update({ [permission]: newValue })
            .eq('user_id', userId)
            .eq('household_id', householdId);

          if (error) throw error;
          
          // Optimistic update
          member[permission] = newValue;
          members = [...members]; // trigger reactivity
      } catch (error) {
          console.error('Error updating permission:', error);
          alert('Failed to update permission');
      }
  }

  function handleLogout() {
      supabase.auth.signOut().then(() => goto('/auth/login'));
  }
</script>

<svelte:head>
  <title>Settings - WhoFed</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 pb-20">
  <!-- Header -->
  <header class="bg-white px-6 py-4 flex items-center sticky top-0 z-10 shadow-sm">
    <a href="/" class="mr-4 text-gray-500 hover:text-gray-900">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
    </a>
    <h1 class="text-xl font-bold text-gray-900">Settings</h1>
  </header>

  <main class="p-6 max-w-lg mx-auto space-y-6">
      <!-- Account Settings -->
     <section class="bg-white rounded-2xl p overflow-hidden shadow-sm">
        <div class="p-4 border-b border-gray-100 font-bold text-gray-900">Account Settings</div>
        <div class="divide-y divide-gray-100">
            <button class="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                <div class="flex items-center space-x-3 text-gray-700">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>Reset Password</span>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                </svg>
            </button>
        </div>
     </section>

     <!-- Family Sharing -->
     <section class="bg-white rounded-2xl p overflow-hidden shadow-sm">
        <div class="p-4 border-b border-gray-100">
            <div class="font-bold text-gray-900">Family Sharing</div>
            <p class="text-xs text-gray-500 mt-1">Share pet profiles, invite family or sitters.</p>
        </div>
        
        <div class="p-4">
             <button 
                class="bg-primary-500 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-primary-600 transition-colors shadow-sm"
                on:click={() => showInviteModal = true}
            >
                Invite Member
            </button>
        </div>

        {#if loading}
             <div class="p-4 text-center text-gray-400">Loading members...</div>
        {:else}
             <div class="divide-y divide-gray-100 border-t border-gray-100">
                 {#each members as member}
                    <div class="p-4 flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold">
                                {member.first_name ? member.first_name[0] : '?'}
                            </div>
                            <div>
                                <div class="font-medium text-gray-900">{member.first_name} {member.user_id === currentUser?.id ? '(You)' : ''}</div>
                                <div class="text-xs text-gray-500">{member.role}</div>
                            </div>
                        </div>

                        <!-- Permissions (Only show for non-owners, logic simplified) -->
                        {#if member.role !== 'owner' && isOwner}
                            <div class="flex items-center space-x-2">
                                <span class="text-xs text-gray-400 mr-1">Can Log</span>
                                <button 
                                    class="w-10 h-5 rounded-full transition-colors relative {member.can_log ? 'bg-primary-500' : 'bg-gray-200'}"
                                    on:click={() => togglePermission(member.user_id, 'can_log')}
                                >
                                    <div class="w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-all {member.can_log ? 'left-5.5' : 'left-1'}"></div>
                                </button>
                            </div>
                        {:else if member.role === 'owner'}
                            <span class="text-xs font-bold text-primary-500 bg-primary-50 px-2 py-1 rounded">Owner</span>
                        {/if}
                    </div>
                 {/each}
             </div>
        {/if}
     </section>

     <!-- General -->
     <section class="bg-white rounded-2xl p overflow-hidden shadow-sm">
        <div class="p-4 border-b border-gray-100 font-bold text-gray-900">General</div>
        <div class="divide-y divide-gray-100">
            <div class="flex items-center justify-between p-4">
                 <div class="flex items-center space-x-3 text-gray-700">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Language</span>
                </div>
                <select class="text-sm bg-transparent text-gray-500 focus:outline-none">
                    <option>English</option>
                    <option>Spanish</option>
                    <option>Portuguese</option>
                </select>
            </div>
             <div class="flex items-center justify-between p-4">
                 <div class="flex items-center space-x-3 text-gray-700">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <span>Notifications</span>
                </div>
                <div class="w-10 h-5 bg-primary-500 rounded-full relative">
                    <div class="w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 right-1"></div>
                </div>
            </div>
        </div>
     </section>

     <div class="pt-4 text-center cursor-pointer" on:click={handleLogout}>
         <span class="text-red-500 font-medium">Log Out</span>
     </div>

     <div class="text-center text-xs text-gray-400 pb-6">
         Version 2.4.0 (PetCore Pro)
     </div>
  </main>
  
  <!-- Invite Modal (Placeholder) -->
  {#if showInviteModal}
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 relative animate-fade-in">
             <button class="absolute top-4 right-4 text-gray-400" on:click={() => showInviteModal = false}>
                 <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                 </svg>
             </button>
             
             <h3 class="text-xl font-bold text-gray-900 mb-2">Invite Family Member</h3>
             <p class="text-sm text-gray-500 mb-6">Share pet care responsibilities via email or scanning a code.</p>
             
             <div class="mb-4">
                 <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Email Address</label>
                 <input type="email" placeholder="Enter their email" class="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-primary-500 outline-none" />
             </div>
             
             <div class="relative py-4">
                 <div class="absolute inset-0 flex items-center">
                     <div class="w-full border-t border-gray-100"></div>
                 </div>
                 <div class="relative flex justify-center text-sm">
                     <span class="px-2 bg-white text-gray-500">OR</span>
                 </div>
             </div>
             
             <div class="flex justify-center py-4">
                 <div class="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                     </svg>
                 </div>
             </div>
             
             <button class="w-full mt-4 flex items-center justify-center space-x-2 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50">
                 <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                 </svg>
                 <span>Share Invite QR</span>
             </button>
        </div>
    </div>
  {/if}

</div>
