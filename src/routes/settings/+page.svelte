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
  
  // Profile state
  let showEditProfileModal = false;
  let profile = {
      first_name: '',
      last_name: '',
      phone: '',
      username: '',
      email: ''
  };
  let error = '';

  async function saveProfile() {
      if (!currentUser) return;
      loading = true;
      error = '';

      try {
          const updates = {
              id: currentUser.id,
              first_name: profile.first_name,
              last_name: profile.last_name,
              phone: profile.phone,
              updated_at: new Date().toISOString()
          };

          const { error: err } = await supabase
              .from('profiles')
              .upsert(updates);

          if (err) throw err;

          // Success
          showEditProfileModal = false;
          // Reload settings to ensure fresh data
          await loadSettings();
          
      } catch (e: any) {
          console.error('Error saving profile:', e);
          error = e.message || 'Failed to save profile';
      } finally {
          loading = false;
      }
  }

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
        // 0. Get My Profile
        const { data: myProfile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
            
        if (profileError) throw profileError;
        if (myProfile) {
            profile = {
                first_name: myProfile.first_name || '',
                last_name: myProfile.last_name || '',
                phone: myProfile.phone || '',
                username: myProfile.username || '',
                email: myProfile.email || currentUser.email || ''
            };
        }

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
  <header class="bg-gray-50 px-6 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center">
    <button on:click={() => goto('/')} class="mr-4 p-2 -ml-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-all">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
    <h1 class="text-xl font-bold text-gray-900">Settings</h1>
  </header>

  <main class="p-6 max-w-lg mx-auto space-y-6">
      <!-- Profile Settings (Editable via Modal) -->
      <!-- Profile Card -->
     <section class="bg-white rounded-2xl p-6 shadow-sm relative overflow-hidden">
        <div class="flex items-center space-x-4">
            <div class="w-16 h-16 rounded-full bg-brand-sage/10 text-brand-sage flex items-center justify-center text-2xl font-bold">
                {profile.first_name ? profile.first_name[0] : '?'}
            </div>
            <div class="flex-1">
                <h2 class="text-xl font-bold text-gray-900">{profile.first_name} {profile.last_name}</h2>
                <p class="text-sm text-gray-500">{profile.phone || 'No phone set'}</p>
            </div>
            <button 
                class="p-2 text-gray-400 hover:text-brand-sage transition-colors rounded-full hover:bg-gray-50"
                on:click={() => showEditProfileModal = true}
            >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
            </button>
        </div>
     </section>

      <!-- Family Sharing -->
      <section class="bg-white rounded-2xl overflow-hidden shadow-sm">
         <div class="p-4 border-b border-gray-100 flex items-center justify-between">
             <div>
                <div class="font-bold text-gray-900">Family & Access</div>
                <p class="text-xs text-gray-500">Manage who can access this home.</p>
             </div>
             <button 
                class="bg-brand-sage/10 text-brand-sage p-2 rounded-full hover:bg-brand-sage/20 transition-colors"
                on:click={() => showInviteModal = true}
            >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                </svg>
            </button>
         </div>

         {#if loading}
              <div class="p-4 text-center text-gray-400">Loading members...</div>
         {:else}
              <div class="divide-y divide-gray-100">
                  {#each members as member}
                     <div class="p-4 flex items-center justify-between">
                         <div class="flex items-center space-x-3">
                             <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-sm">
                                 {member.first_name ? member.first_name[0] : '?'}
                             </div>
                             <div>
                                 <div class="font-medium text-gray-900 text-sm">{member.first_name} {member.user_id === currentUser?.id ? '(You)' : ''}</div>
                                 <div class="text-xs text-brand-sage font-medium">{member.role === 'owner' ? 'Owner' : 'Member'}</div>
                             </div>
                         </div>
 
                         <!-- Permissions (Only show for non-owners, logic simplified) -->
                         {#if member.role !== 'owner' && isOwner}
                             <div class="flex items-center space-x-2">
                                 <button 
                                     class="w-10 h-6 rounded-full transition-colors relative {member.can_log ? 'bg-brand-sage' : 'bg-gray-200'}"
                                     on:click={() => togglePermission(member.user_id, 'can_log')}
                                 >
                                     <div class="w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm {member.can_log ? 'left-5' : 'left-1'}"></div>
                                 </button>
                             </div>
                         {/if}
                     </div>
                  {/each}
              </div>
         {/if}
      </section>

      <!-- Account & General -->
      <section class="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
         <!-- Account Info -->
         <div class="p-4">
             <div class="font-bold text-gray-900 mb-4">Account</div>
             <div class="space-y-4">
                <div class="flex justify-between items-center">
                    <div class="text-sm text-gray-500">Email</div>
                    <div class="text-sm font-medium text-gray-900">{profile.email || 'No email set'}</div>
                </div>
                <!-- Username removed as it's less critical for settings view, kept in edit modal if needed or just rely on profile -->
             </div>
             <div class="mt-6 space-y-2">
                <button class="w-full py-3 bg-gray-50 rounded-xl text-gray-600 font-bold text-xs uppercase tracking-wider hover:bg-gray-100 transition-colors">
                    Reset Password
                </button>
             </div>
         </div>
      </section>

      <section class="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
         <div class="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer">
              <div class="flex items-center space-x-3 text-gray-700">
                 <div class="p-2 bg-blue-50 text-blue-500 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                 </div>
                 <span class="font-medium text-sm">Notifications</span>
             </div>
             <div class="w-10 h-6 bg-brand-sage rounded-full relative">
                 <div class="w-4 h-4 bg-white rounded-full absolute top-1 right-1 shadow-sm"></div>
             </div>
         </div>
         
         <div class="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer" on:click={handleLogout}>
            <div class="flex items-center space-x-3 text-red-600">
               <div class="p-2 bg-red-50 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
               </div>
               <span class="font-medium text-sm">Log Out</span>
           </div>
       </div>
      </section>


  </main>
  
  <!-- Edit Profile Modal -->
  {#if showEditProfileModal}
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 relative animate-fade-in">
             <button class="absolute top-4 right-4 text-gray-400" on:click={() => showEditProfileModal = false}>
                 <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                 </svg>
             </button>
             
             <h3 class="text-xl font-bold text-gray-900 mb-6">Edit Profile</h3>
             
             {#if error}
               <div class="mb-4 text-sm text-red-500 bg-red-50 p-3 rounded-lg">
                 {error}
               </div>
             {/if}

             <div class="space-y-4">
                 <div class="grid grid-cols-2 gap-4">
                     <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1" for="firstName">First Name</label>
                        <input id="firstName" type="text" bind:value={profile.first_name} class="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-brand-sage outline-none" placeholder="First Name" />
                     </div>
                     <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1" for="lastName">Last Name</label>
                        <input id="lastName" type="text" bind:value={profile.last_name} class="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-brand-sage outline-none" placeholder="Last Name" />
                     </div>
                 </div>

                 <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1" for="pfPhone">Phone</label>
                    <input id="pfPhone" type="tel" bind:value={profile.phone} class="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-brand-sage outline-none" placeholder="(555) 123-4567" />
                 </div>
                 
                 <button 
                    class="w-full mt-4 bg-brand-sage text-white font-bold py-3 rounded-xl shadow-lg shadow-brand-sage/20 disabled:opacity-50 flex items-center justify-center transform active:scale-95 transition-all"
                    disabled={loading}
                    on:click={saveProfile}
                 >
                    {#if loading}
                      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    {/if}
                    Save Changes
                 </button>
             </div>
        </div>
    </div>
  {/if}

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
