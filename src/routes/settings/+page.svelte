<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import type { Database } from '$lib/database.types';
  import { APP_VERSION } from '$lib/version';
  import { onboarding } from '$lib/stores/onboarding';
  import { activeHousehold, availableHouseholds, switchHousehold } from '$lib/stores/appState';
  import { userIsPremium } from '$lib/stores/user';
  import PetIcon from '$lib/components/PetIcon.svelte';
  import InviteMemberModal from '$lib/components/InviteMemberModal.svelte';
  import NotificationsModal from '$lib/components/NotificationsModal.svelte';

  type MemberProfile = {
      user_id: string;
      role: 'owner' | 'member'; // derived
      first_name: string | null;
      last_name: string | null;
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
  let canInvite = false;

  // Invite / Notifications state
  let showInviteMemberModal = false;
  let inviteHouseholdId = '';
  let showNotificationsModal = false;
  let pendingInviteCount = 0;
  
  let showEditProfileModal = false;
  let profile = {
      first_name: '',
      last_name: '',
      phone: '',
      username: '',
      email: ''
  };
  let error = '';

  // Member Management
  let showRemoveMemberModal = false;
  let showLeaveHouseholdModal = false;
  let showDeleteHouseholdModal = false;
  let showCannotDeleteModal = false;
  let showEditHouseholdModal = false;
  let editingHousehold: { id: string, name: string } | null = null;
  let memberToRemove: { user_id: string, first_name: string } | null = null;

  // Household to switch to or create
  let showCreateHouseholdModal = false;
  let newHouseholdName = '';
  let expandedHouseholdId: string | null = null;
  let householdMembersCache: Record<string, MemberProfile[]> = {};
  let householdIdForAction: string | null = null;

  // Pets State
  let pets: any[] = [];
  let showEditPetModal = false;
  let showPetIconModal = false; // Nested modal for picking icon
  let editingPet: any = { id: '', name: '', species: '', icon: '' };
  
  // Edit State
  let editPetName = '';
  let editPetSpecies = '';
  let editPetIcon = '';
  let fileInput: HTMLInputElement;
  let isUploading = false;
  
  // Icon Constants (Shared with Add Page)
  const FREE_ICONS = ['🐶', '🐱', '🐰', '🐦', '🐠', '🐾', '🐕', '🐈', '🐹', '🐢'];
  const PREMIUM_ICONS = [
      '🦎', '🐍', '🦄', '🦖', '🦕', '🦂', '🕷️', '🐙', '🦑', '🦐', '🦞', '🦀', 
      '🐡', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', 
      '🦒', '🦘', '🐃', '🐏', '🦙', '🐐', '🦌', '🦇', '🦅', '🦆', '🦢', '🦉', 
      '🦩', '🦚', '🦜', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔',
      '🐉', '👽', '🤖', '👻', '🤡', '👹', '👺', '☠️', '💩', '👾', '🎃', '🦴'
  ];
  const QUICK_SPECIES_LABELS = ['Dog', 'Cat', 'Bird', 'Hamster', 'Rabbit', 'Fish', 'Lizard', 'Snake', 'Turtle'];

  async function savePet() {
      loading = true;
      try {
          const { error } = await supabase
            .from('pets')
            .update({
                name: editPetName,
                species: editPetSpecies,
                icon: editPetIcon
            })
            .eq('id', editingPet.id);

          if (error) throw error;
          
          showEditPetModal = false;
          await loadSettings(); // Reload to refresh list
      } catch (e: any) {
          console.error('Error saving pet:', e);
          alert('Failed to save pet: ' + e.message);
      } finally {
          loading = false;
      }
  }

  function openEditPet(pet: any) {
      editingPet = pet;
      editPetName = pet.name;
      editPetSpecies = pet.species;
      editPetIcon = pet.icon || '🐾';
      showEditPetModal = true;
  }

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

        // 1. Get household from active store (already set by layout)
        const currentHousehold = $activeHousehold;
        if (!currentHousehold) {
            console.error('No active household');
            return;
        }
        householdId = currentHousehold.id;

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
                profiles (first_name, last_name, email)
            `)
            .eq('household_id', householdId);

        if (memberError) throw memberError;

        // 4. Get Pets
        const { data: petData, error: petError } = await supabase
            .from('pets')
            .select('*')
            .eq('household_id', householdId)
            .order('name');

        if (petError) throw petError;
        pets = petData || [];

        members = (memberData || []).map((m: any) => ({
            user_id: m.user_id,
            role: m.user_id === household.owner_id ? 'owner' : 'member',
            first_name: m.profiles?.first_name || 'Unknown',
            last_name: m.profiles?.last_name || null,
            email: m.profiles?.email || '',
            can_log: m.can_log,
            can_edit: m.can_edit,
            is_active: m.is_active
        }));
        
        // Monetization Check: Free tier limit is 2 members
        const MEMBER_LIMIT = 2;
        canInvite = $userIsPremium || members.length < MEMBER_LIMIT;

        // 5. Get pending invite count for current user
        const { count: invCount } = await supabase
            .from('household_invitations')
            .select('*', { count: 'exact', head: true })
            .eq('invited_user_id', currentUser.id)
            .eq('status', 'pending');
        pendingInviteCount = invCount || 0;
        
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



  let showPremiumModal = false;
  let showDeleteAccountModal = false;

  function openInviteModal(hhId: string) {
      // Monetization Gate: re-check at click time since store may have loaded after initial render
      const MEMBER_LIMIT = 2;
      if (!$userIsPremium && members.length >= MEMBER_LIMIT) {
          showPremiumModal = true;
          return;
      }
      inviteHouseholdId = hhId;
      showInviteMemberModal = true;
  }
  
  async function handleExportData() {
      if (!$userIsPremium) {
          showPremiumModal = true;
          return;
      }
      
      try {
          // Fetch ALL logs for current views
          // Since we need household-wide logs, we need a way to find all pets
          // But our current helpers are scoped. 
          // Let's rely on RLS: We can just query `activity_log` directly and rely on RLS to filter to our household.
          // BUT `activity_log` doesn't strictly have household_id on it? It has `pet_id`.
          // We need to join pets.
          
          const { data, error } = await supabase
            .from('activity_log')
            .select(`
                performed_at,
                action_type,
                pets (name),
                profiles (first_name, email),
                schedules (label),
                daily_tasks (label)
            `)
            .order('performed_at', { ascending: false });

          if (error) throw error;
          
          if (!data || data.length === 0) {
              alert('No history found to export.');
              return;
          }

          // Convert to PDF
          // We must dynamic import to ensure client-side execution if SSR is involved, 
          // though this function is triggered by click so standard import might work if it wasn't for SSR.
          // Safer to use import() inside the function or just standard ESD imports if we are in onMount/browser.
          // Since we are in SvelteKit, let's dynamic import to be safe.
          const { jsPDF } = await import('jspdf');
          const autoTable = (await import('jspdf-autotable')).default;

          const doc = new jsPDF();

          // 1. Title & Header
          doc.setFontSize(22);
          doc.setTextColor(47, 79, 79); // Dark Sage
          doc.text('WhoFed Export', 14, 20);
          
          doc.setFontSize(10);
          doc.setTextColor(100, 100, 100);
          doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

          // 2. Prepare Table Data
          const tableHeaders = [['Date', 'Pet', 'Action', 'Details', 'Performed By']];
          
          const formatAction = (action: string) => {
             if (action === 'unfed') return 'un-fed';
             if (action === 'unmedicated') return 'un-medicated';
             return action;
          }
          
          const tableRows = data.map((row: any) => {
              const date = new Date(row.performed_at);
              const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
              
              const details = row.schedules?.label || row.daily_tasks?.label || '-';

              return [
                  dateStr,
                  row.pets?.name || 'Unknown Pet',
                  formatAction(row.action_type),
                  details,
                  row.profiles?.first_name || 'Unknown User'
              ];
          });

          // 3. Render Table
          autoTable(doc, {
              head: tableHeaders,
              body: tableRows,
              startY: 35,
              theme: 'grid',
              headStyles: {
                  fillColor: [75, 114, 109], // Brand Sage Green
                  textColor: 255,
                  fontStyle: 'bold'
              },
              styles: {
                  fontSize: 10,
                  cellPadding: 3
              },
              alternateRowStyles: {
                  fillColor: [245, 247, 247] // Very light sage/gray
              }
          });

          // 4. Save
          doc.save(`WhoFed_Export.pdf`);
          
      } catch (err: any) {
          console.error('Export failed:', err);
          alert('Failed to export data: ' + err.message);
      }
  }

  async function handleLogout() {
      try {
          console.log('Logging out...');
          await supabase.auth.signOut();
          console.log('Signed out, redirecting...');
          goto('/auth/login');
      } catch (e) {
          console.error('Logout failed:', e);
          // Force redirect anyway
          goto('/auth/login');
      }
  }

  // Member Management Functions
  async function removeMember() {
      if (!memberToRemove || !householdIdForAction) return;
      try {
          const { error } = await supabase
              .from('household_members')
              .delete()
              .eq('household_id', householdIdForAction)
              .eq('user_id', memberToRemove.user_id);
          
          if (error) throw error;
          
          showRemoveMemberModal = false;
          // Refresh cache for this household
          delete householdMembersCache[householdIdForAction];
          householdMembersCache = householdMembersCache;
          await toggleHouseholdAccordion(householdIdForAction); // Re-expand to refetch
          memberToRemove = null;
          householdIdForAction = null;
      } catch (e: any) {
          console.error('Error removing member:', e);
          alert('Failed to remove member: ' + e.message);
      }
  }

  async function leaveHousehold() {
      if (!householdIdForAction || !currentUser) return;
      try {
          const { error } = await supabase
              .from('household_members')
              .delete()
              .eq('household_id', householdIdForAction)
              .eq('user_id', currentUser.id);
          
          if (error) throw error;
          
          showLeaveHouseholdModal = false;
          householdIdForAction = null;
          // Redirect to home - they'll need to pick another household or create one
          goto('/');
      } catch (e: any) {
          console.error('Error leaving household:', e);
          alert('Failed to leave household: ' + e.message);
      }
  }

  async function initiateDeleteHousehold(hhId: string) {
      householdIdForAction = hhId;
      
      try {
          // Check for dependencies (Members/Pets)
          const { count: memberCount, error: memberError } = await supabase
              .from('household_members')
              .select('*', { count: 'exact', head: true })
              .eq('household_id', hhId);
          if (memberError) throw memberError;

          const { count: petCount, error: petError } = await supabase
              .from('pets')
              .select('*', { count: 'exact', head: true })
              .eq('household_id', hhId);
          if (petError) throw petError;

          // If not empty (members > 1 for owner, pets > 0) -> Block
          if ((memberCount || 0) > 1 || (petCount || 0) > 0) {
              showCannotDeleteModal = true;
          } else {
              showDeleteHouseholdModal = true;
          }
      } catch (e) {
          console.error('Check failed:', e);
          alert('Error checking household status');
      }
  }

  async function deleteHousehold() {
      console.log('Attempting DELETE:', { householdIdForAction, ownerId: currentUser.id });

      if (!householdIdForAction) return; 
      try {
          // Delete household (Safe to delete since it's confirmed empty)
          const { error, count, data } = await supabase
              .from('households')
              .delete({ count: 'exact' })
              .eq('id', householdIdForAction)
              .eq('owner_id', currentUser.id)
              .select(); // Select to see what was deleted
          
          console.log('DELETE Result:', { error, count, data });

          if (error) throw error;
          
          if (count === 0) {
              alert(`Delete failed silently. Debug Info:\nTarget ID: ${householdIdForAction}\nOwner Match: ${currentUser.id}\nRLS Policy likely blocking DELETE.`);
              return;
          }

          showDeleteHouseholdModal = false;
          householdIdForAction = null;
          // Reload page to refresh list and clear invalid state
          window.location.reload(); 
      } catch (e: any) {
          console.error('Error deleting household:', e);
          alert('Failed to delete household: ' + e.message);
      }
  }

  async function toggleHouseholdAccordion(hhId: string) {
      // Toggle - if already open, close it
      if (expandedHouseholdId === hhId) {
          expandedHouseholdId = null;
          return;
      }
      
      expandedHouseholdId = hhId;
      
      // If we already have members cached, don't refetch
      if (householdMembersCache[hhId]) return;
      
      // Fetch members for this household
      try {
          const { data: hh } = await supabase
              .from('households')
              .select('owner_id')
              .eq('id', hhId)
              .single();
              
          const { data: memberData, error: memberError } = await supabase
              .from('household_members')
              .select(`
                  user_id,
                  can_log,
                  can_edit,
                  is_active,
                  profiles (
                      first_name,
                      last_name,
                      email
                  )
              `)
              .eq('household_id', hhId);

          if (memberError) throw memberError;

          const fetchedMembers: MemberProfile[] = (memberData || []).map(m => ({
              user_id: m.user_id,
              role: hh?.owner_id === m.user_id ? 'owner' : 'member',
              first_name: (m.profiles as any)?.first_name || 'Unknown',
              last_name: (m.profiles as any)?.last_name || null,
              email: (m.profiles as any)?.email || null,
              can_log: m.can_log ?? true,
              can_edit: m.can_edit ?? false,
              is_active: m.is_active ?? true
          }));
          
          householdMembersCache[hhId] = fetchedMembers;
          householdMembersCache = householdMembersCache; // Trigger reactivity
      } catch (e) {
          console.error('Error fetching household members:', e);
      }
  }

  function openEditHouseholdModal(hh: any) {
      editingHousehold = { id: hh.id, name: hh.name };
      showEditHouseholdModal = true;
  }

  async function updateHouseholdName() {
      if (!editingHousehold || !editingHousehold.name.trim()) return;
      
      try {
          const { error } = await supabase
              .from('households')
              .update({ name: editingHousehold.name.trim() })
              .eq('id', editingHousehold.id);

          if (error) throw error;

          // Update local stores
          availableHouseholds.update(hhs => 
              hhs.map(h => h.id === editingHousehold!.id ? { ...h, name: editingHousehold!.name } : h)
          );

          if ($activeHousehold?.id === editingHousehold.id) {
              activeHousehold.update(h => h ? { ...h, name: editingHousehold!.name } : null);
          }

          showEditHouseholdModal = false;
          editingHousehold = null;

      } catch (e: any) {
          console.error('Error updating household:', e);
          alert('Failed to update household: ' + e.message);
      }
  }

  async function createNewHousehold() {
      if (!newHouseholdName.trim() || !currentUser) return;

      // Premium gate: free users can own max 1 household
      if (!$userIsPremium) {
          const ownedCount = $availableHouseholds.filter(h => h.role === 'owner').length;
          if (ownedCount >= 1) {
              showPremiumModal = true;
              return;
          }
      }

      try {
          // 1. Create household
          const { data: household, error: hhError } = await supabase
              .from('households')
              .insert({
                  owner_id: currentUser.id,
                  name: newHouseholdName.trim(),
                  subscription_status: 'free'
              })
              .select()
              .single();
          
          if (hhError) throw hhError;
          
          // 2. Add user as member
          const { error: memberError } = await supabase
              .from('household_members')
              .insert({
                  household_id: household.id,
                  user_id: currentUser.id,
                  is_active: true,
                  can_log: true,
                  can_edit: true
              });
          
          if (memberError) throw memberError;
          // 3. Switch to it (Store update + Persistence)
          switchHousehold({ 
              id: household.id, 
              name: household.name, 
              role: 'owner', 
              subscription_status: household.subscription_status 
          });
          
          showCreateHouseholdModal = false;
          newHouseholdName = '';
          
          // Expand the new household in the list
          expandedHouseholdId = household.id;
          
          // Force refresh of available households
          const { data: updatedHouseholds } = await supabase
              .from('households')
              .select('*')
              .eq('owner_id', currentUser.id);
              
          if (updatedHouseholds) {
              const mapped = updatedHouseholds.map(h => ({
                  id: h.id, 
                  name: h.name, 
                  role: 'owner' as const, 
                  subscription_status: h.subscription_status 
              }));
              availableHouseholds.set(mapped);
          }
      } catch (e: any) {
          console.error('Error creating household:', e);
          alert('Failed to create household: ' + e.message);
      }
  }

</script>

<svelte:head>
  <title>Settings - WhoFed</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 pb-20">
  <!-- Header -->
  <header class="bg-gray-50 px-6 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center">
    <a href="/" class="mr-4 p-2 -ml-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-all">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
      </svg>
    </a>
    <h1 class="text-xl font-bold text-gray-900">Settings</h1>
    <div class="flex-1"></div>
    <div class="flex items-center space-x-2">
        <button class="relative p-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-all" on:click={() => showNotificationsModal = true}>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {#if pendingInviteCount > 0}
                <span class="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            {/if}
        </button>
    </div>
  </header>

  <main class="p-6 max-w-lg mx-auto space-y-6">
      <!-- Profile Settings (Editable via Modal) -->
       <div class="space-y-2">
         <div class="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Personal Identity</div>
         <!-- Profile Card -->
         <section class="bg-white rounded-2xl p-6 shadow-sm relative overflow-hidden">
             <div class="flex items-start justify-between">
                 <div class="flex-1">
                     <h2 class="text-xl font-bold text-gray-900 mb-1">{profile.first_name} {profile.last_name}</h2>
                     <p class="text-sm text-gray-500 mb-1">{profile.phone || 'No phone set'}</p>
                     {#if profile.username}
                         <p class="text-sm text-brand-sage font-medium">@{profile.username.replace('@','')}</p>
                     {/if}
                 </div>
                 <button 
                     class="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200 transition-colors rounded-full"
                     on:click={() => showEditProfileModal = true}
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                     </svg>
                 </button>
             </div>
         </section>
       </div>



      <!-- Account & General (Moved here) -->
       <div class="space-y-2">
          <div class="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Security & Account</div>
          <section class="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100" data-tour="settings-preferences">
             <!-- Email Row -->
             <div class="p-4 flex items-center justify-between">
                 <div>
                     <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Primary Email</p>
                     <p class="text-sm font-medium text-gray-900">{profile.email || 'No email set'}</p>
                 </div>
                 <div class="flex items-center text-brand-sage font-medium text-xs cursor-default">
                     <!-- <span>Change</span> -->
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-300 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                     </svg>
                 </div>
             </div>
             
             <!-- Password Row (Used to be Reset Password Button) -->
             <button class="w-full text-left p-4 flex items-center justify-between hover:bg-gray-50 transition-colors" on:click={() => { /* Reuse existing reset logic or just placeholder */ }}>
                 <div>
                     <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Password</p>
                     <p class="text-sm font-bold text-gray-900 tracking-widest">••••••••••••</p>
                 </div>
                 <div class="flex items-center text-brand-sage font-medium text-xs">
                     <span>Update</span>
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-300 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                     </svg>
                 </div>
             </button>
          </section>
          <p class="text-xs text-gray-400 px-1 leading-relaxed">
              Changes to sensitive information may require a secondary verification step to ensure your account's safety.
          </p>
       </div>

       <!-- My Households -->
       <div class="space-y-2">
         <div class="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">My Households</div>
         <section class="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
             
             <!-- Header / Action -->
             <div class="p-4 flex items-center justify-between">
                 <div>
                     <h3 class="font-bold text-gray-900 leading-tight">Manage Households</h3>
                     <p class="text-xs text-gray-500 mt-1">Manage your households and access levels.</p>
                 </div>
                 <button 
                     class="w-8 h-8 rounded-full bg-brand-sage/10 text-brand-sage flex items-center justify-center hover:bg-brand-sage/20 transition-colors"
                     on:click={() => showCreateHouseholdModal = true}
                     title="Create new household"
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                         <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd" />
                     </svg>
                 </button>
             </div>

             <!-- Households List -->
             {#each $availableHouseholds as hh}
                 <div>
                     <button 
                         class="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                         on:click={() => toggleHouseholdAccordion(hh.id)}
                     >
                         <div class="flex items-center space-x-3">
                             <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100 text-gray-500">
                                 <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                     <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                                 </svg>
                             </div>
                             <div>
                                 <div class="font-bold text-gray-900 text-sm flex items-center space-x-2">
                                     <span>{hh.name}</span>
                                     {#if hh.role === 'owner'}
                                         <button
                                             on:click|stopPropagation={() => openEditHouseholdModal(hh)}
                                             class="text-gray-400 hover:text-brand-sage p-0.5"
                                         >
                                             <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                 <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                             </svg>
                                         </button>
                                     {/if}
                                 </div>
                                 <div class="text-xs {hh.role === 'owner' ? 'text-brand-sage font-bold' : 'text-gray-400 font-medium'}">
                                     {hh.role === 'owner' ? 'Owner' : `Member (owner: ${hh.ownerName || 'Unknown'})`}
                                 </div>
                             </div>
                         </div>
                         <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-300 transition-transform {expandedHouseholdId === hh.id ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                         </svg>
                     </button>
 
                     <!-- Accordion Content -->
                     {#if expandedHouseholdId === hh.id}
                         <div class="px-4 pb-4 pt-0 bg-gray-50/50">
                             <div class="pt-3">
                                 <!-- Members Header -->
                                 <div class="flex items-center justify-between mb-3 px-1">
                                     <div class="text-xs font-bold text-gray-400 uppercase tracking-wider">Members</div>
                                     {#if hh.role === 'owner'}
                                         <button 
                                             class="text-xs font-bold text-brand-sage hover:underline flex items-center space-x-1"
                                             on:click={() => openInviteModal(hh.id)}
                                         >
                                             <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                 <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd" />
                                             </svg>
                                             <span>Add Member</span>
                                         </button>
                                     {/if}
                                 </div>
                                 
                                 <!-- Members List -->
                                 {#if householdMembersCache[hh.id]}
                                     <div class="space-y-2">
                                         {#each householdMembersCache[hh.id] as member}
                                             <div class="flex items-center justify-between py-2 px-1">
                                                 <div class="flex items-center space-x-3">
                                                     <div class="w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-600 font-bold text-xs shadow-sm">
                                                         {member.first_name ? member.first_name[0] : '?'}
                                                     </div>
                                                     <div>
                                                         <div class="font-bold text-gray-900 text-xs">
                                                             {[member.first_name, member.last_name].filter(Boolean).join(' ')}
                                                             {member.user_id === currentUser?.id ? ' (You)' : ''}
                                                         </div>
                                                         <div class="text-[10px] uppercase tracking-wide font-bold {member.role === 'owner' ? 'text-brand-sage' : 'text-gray-400'}">
                                                             {member.role === 'owner' ? 'Owner' : 'Member'}
                                                         </div>
                                                     </div>
                                                 </div>
                                                 
                                                 <!-- Actions -->
                                                 <div class="flex items-center space-x-1">
                                                     {#if hh.role === 'owner' && member.user_id !== currentUser?.id}
                                                         <button 
                                                             class="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                                             on:click={() => { memberToRemove = member; householdIdForAction = hh.id; showRemoveMemberModal = true; }}
                                                             title="Remove member"
                                                         >
                                                             <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                             </svg>
                                                         </button>
                                                     {/if}
                                                     {#if hh.role !== 'owner' && member.user_id === currentUser?.id}
                                                         <button 
                                                             class="px-2 py-1 text-[10px] font-bold text-red-500 bg-red-50 rounded hover:bg-red-100 transition-colors uppercase tracking-wide"
                                                             on:click={() => { householdIdForAction = hh.id; showLeaveHouseholdModal = true; }}
                                                         >
                                                             Leave
                                                         </button>
                                                     {/if}
                                                 </div>
                                             </div>
                                         {/each}
                                     </div>
                                 {:else}
                                     <div class="text-xs text-gray-400 py-2 italic">Loading members...</div>
                                 {/if}
                                 
                                 <!-- Delete Household -->
                                 {#if hh.role === 'owner'}
                                     <div class="mt-4 pt-3 border-t border-gray-100">
                                         <button 
                                             class="text-xs font-bold text-red-400 hover:text-red-600 transition-colors flex items-center space-x-1"
                                             on:click={() => initiateDeleteHousehold(hh.id)}
                                         >
                                             <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                             </svg>
                                             <span>Delete Household</span>
                                         </button>
                                     </div>
                                 {/if}
                             </div>
                         </div>
                     {/if}
                 </div>
             {/each}
         </section>
       </div>



       <!-- Subscription (Dev Only Toggle) -->
       <div class="space-y-2">
          <div class="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Subscription</div>
          <section class="bg-white rounded-2xl overflow-hidden shadow-sm">
             <div class="p-4 flex items-center justify-between">
                 <div>
                     <span class="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider {$userIsPremium ? 'bg-brand-sage/10 text-brand-sage' : 'bg-gray-100 text-gray-600'}">
                        {$userIsPremium ? 'Premium User' : 'Free Tier'}
                     </span>
                 </div>
                 <button
                    class="text-xs text-blue-500 hover:underline"
                    on:click={async () => {
                        try {
                            const newTier = $userIsPremium ? 'free' : 'premium';
                            console.log('Toggling user tier to:', newTier);
                            // ... toggle logic ...
                            const { data: updatedRows, error: updateError } = await supabase.from('profiles').update({ tier: newTier }).eq('id', currentUser.id).select();
                            if (updateError) { alert('Failed: ' + updateError.message); } else { window.location.reload(); }
                        } catch (e: any) { alert('Error: ' + e.message); }
                    }}
                 >
                    [Dev: Toggle]
                 </button>
             </div>
          </section>
       </div>
             <!-- About -->
       <div class="space-y-2">
          <div class="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">About</div>
          <section class="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
              <a href="/legal/privacy" class="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                  <span class="text-sm font-bold text-gray-900">Privacy Policy</span>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
              </a>
              <a href="/legal/tos" class="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                  <span class="text-sm font-bold text-gray-900">Terms of Service</span>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
              </a>
              <div class="flex items-center justify-between p-4 bg-gray-50/50">
                  <span class="text-sm font-bold text-gray-900">Version</span>
                  <span class="text-sm text-gray-500">{APP_VERSION}</span>
              </div>
          </section>
       </div>
       
       <div class="h-8"></div>
       <div class="space-y-2">
          <section class="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
              <div class="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer" on:click={handleExportData}>
                  <div class="flex items-center space-x-3 text-gray-700">
                      <div class="p-2 bg-green-50 text-green-600 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                      </div>
                      <div class="flex flex-col">
                          <span class="font-medium text-sm">Export Data</span>
                          {#if !$userIsPremium}
                              <span class="text-[10px] text-brand-sage font-bold uppercase tracking-wide">Premium</span>
                          {/if}
                      </div>
                  </div>
              </div>
              
              <div class="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer" on:click={handleLogout}>
                  <div class="flex items-center space-x-3 text-gray-600">
                      <div class="p-2 bg-gray-100 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                      </div>
                      <span class="font-medium text-sm">Log Out</span>
                  </div>
              </div>

              <!-- Danger Zone: Delete Account -->
              <div class="flex items-center justify-between p-4 hover:bg-red-50 transition-colors cursor-pointer" 
                  on:click={() => showDeleteAccountModal = true}
              >
                  <div class="flex items-center space-x-3 text-red-600">
                      <div class="p-2 bg-red-100 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                      </div>
                      <span class="font-medium text-sm">Delete Account</span>
                  </div>
              </div>
          </section>
       </div>
 
   </main>
  
  <!-- Edit Pet Modal -->
  {#if showEditPetModal && editingPet}
  <div class="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button type="button" class="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" on:click={() => showEditPetModal = false}></button>
      
      <div class="bg-white rounded-[32px] w-full max-w-sm relative z-10 animate-scale-in max-h-[85vh] overflow-y-auto flex flex-col">
          <div class="p-6">
               <div class="flex items-center justify-between mb-6">
                   <h3 class="text-xl font-bold text-gray-900">Edit Pet</h3>
                   <button on:click={() => showEditPetModal = false} class="text-gray-400 hover:text-gray-600">
                       <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                       </svg>
                   </button>
               </div>

               <!-- Icon Selection (Simplified Vertical Layout) -->
               <div class="flex flex-col items-center mb-6">
                   <div class="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg bg-gray-100 mb-4 relative">
                        <PetIcon icon={editPetIcon} size="lg" />
                   </div>
                   
                   <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Select Icon</p>
                   
                   <!-- Unified Grid -->
                   <div class="grid grid-cols-5 gap-2 w-full mb-4">
                       {#each [...FREE_ICONS, ...PREMIUM_ICONS] as icon}
                           <button 
                               type="button"
                               class="aspect-square flex items-center justify-center rounded-lg border-2 {editPetIcon === icon ? 'border-brand-sage bg-brand-sage/5' : 'border-transparent hover:bg-gray-50'}"
                               on:click={() => editPetIcon = icon}
                           >
                               <span class="text-2xl">{icon}</span>
                           </button>
                       {/each}
                   </div>

                   <!-- Custom Upload -->
                   <button 
                        type="button"
                        class="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 font-bold text-sm hover:border-brand-sage hover:text-brand-sage transition-colors flex items-center justify-center space-x-2"
                        on:click={() => {
                            if ($userIsPremium) {
                                fileInput.click();
                            } else {
                                showPremiumModal = true;
                            }
                        }}
                   >
                       {#if isUploading}
                           <span>Uploading...</span>
                       {:else}
                           <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                           </svg>
                           <span>Upload Photo</span>
                       {/if}
                       {#if !$userIsPremium}
                            <span class="text-[10px] bg-gray-100 px-1.5 rounded ml-1">PREM</span>
                       {/if}
                   </button>
                   <input type="file" bind:this={fileInput} class="hidden" accept="image/*" on:change={handleFileUpload} />
               </div>

               <div class="space-y-4">
                   <div>
                       <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Name</label>
                       <input type="text" bind:value={editPetName} class="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-900 outline-none focus:ring-2 focus:ring-brand-sage/20 transition-all" />
                   </div>
                   <div>
                       <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Species</label>
                       <input type="text" bind:value={editPetSpecies} class="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-900 outline-none focus:ring-2 focus:ring-brand-sage/20 transition-all" />
                   </div>
               </div>

               <button 
                   class="w-full mt-6 py-4 bg-brand-sage text-white font-bold rounded-2xl shadow-lg shadow-brand-sage/20 active:scale-95 transition-transform"
                   on:click={savePetEdits}
               >
                   Save Changes
               </button>
               
               {#if isOwner}
               <button 
                   class="w-full mt-2 py-4 text-red-500 font-bold rounded-xl hover:bg-red-50 transition-colors"
                   on:click={deletePet}
               >
                   Delete Pet
               </button>
               {/if}
          </div>
      </div>
  </div>
  {/if}

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
                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1" for="pfUsername">Username</label>
                    <input id="pfUsername" type="text" bind:value={profile.username} class="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-brand-sage outline-none" placeholder="@username" />
                 </div>

                 <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1" for="pfPhone">Phone</label>
                    <input id="pfPhone" type="tel" bind:value={profile.phone} class="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-brand-sage outline-none" placeholder="(555) 123-4567" />
                    <p class="text-[10px] text-gray-400 mt-1 leading-tight">
                       By providing your number, you agree to receive SMS feeding reminders. See our <a href="/legal/privacy" class="underline hover:text-gray-600" target="_blank">Privacy Policy</a>. Msg & data rates may apply.
                    </p>
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

  <!-- Invite Member Modal -->
  {#if showInviteMemberModal}
    <InviteMemberModal householdId={inviteHouseholdId} {canInvite} on:close={() => showInviteMemberModal = false} />
  {/if}

  <!-- Notifications Modal -->
  {#if showNotificationsModal}
    <NotificationsModal on:close={() => showNotificationsModal = false} />
  {/if}

  <!-- PREMIUM UPSELL MODAL -->
  {#if showPremiumModal}
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <!-- Backdrop -->
      <button type="button" class="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" on:click={() => showPremiumModal = false}></button>
      
      <!-- Modal -->
      <div class="bg-white rounded-[32px] overflow-hidden w-full max-w-sm shadow-2xl relative z-10 animate-scale-in">
          <!-- Header Image/Pattern -->
          <div class="h-32 bg-brand-sage flex items-center justify-center relative overflow-hidden">
              <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
              <!-- Diamond Icon -->
              <div class="w-16 h-16 bg-white rounded-full flex items-center justify-center text-3xl shadow-lg relative z-10">
                  💎
              </div>
          </div>
          
          <div class="p-8 text-center">
              <h3 class="text-2xl font-bold text-gray-900 mb-2">Upgrade to Premium</h3>
              <p class="text-gray-500 mb-6 leading-relaxed">
                  You've reached the limit of the Free plan.
                  <br>
                  <span class="font-bold text-gray-800">Unlock unlimited pets, members & history!</span>
              </p>
              
              <div class="space-y-3">
                  <button 
                      class="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl shadow-xl hover:bg-black transition-all transform hover:scale-[1.02] active:scale-95"
                      on:click={() => {
                          alert('Payment Flow would start here!');
                          showPremiumModal = false;
                      }}
                  >
                      Check Pricing
                  </button>
                  <button 
                      class="w-full py-4 text-gray-400 font-bold text-sm hover:text-gray-600"
                      on:click={() => showPremiumModal = false}
                  >
                      Maybe Later
                  </button>
              </div>
          </div>
      </div>
  </div>
  {/if}

  <!-- DELETE ACCOUNT MODAL -->
  {#if showDeleteAccountModal}
  <div class="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <!-- Backdrop -->
      <button type="button" class="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" on:click={() => showDeleteAccountModal = false}></button>
      
      <!-- Modal -->
      <div class="bg-white rounded-[32px] overflow-hidden w-full max-w-sm shadow-2xl relative z-10 animate-scale-in">
          <!-- Header Image/Pattern -->
          <div class="h-24 bg-red-50 flex items-center justify-center relative overflow-hidden">
              <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
              <!-- Warning Icon -->
              <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-500 shadow-sm relative z-10">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
              </div>
          </div>
          
          <div class="p-6 text-center">
              <h3 class="text-xl font-bold text-gray-900 mb-2">Delete Account?</h3>
              <p class="text-gray-500 mb-6 text-sm leading-relaxed">
                  This action is <span class="font-bold text-red-600">permanent</span> and cannot be undone.<br>All your pets, logs, and data will be erased immediately.
              </p>
              
              <div class="space-y-3">
                  <button 
                      class="w-full py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg hover:bg-red-700 transition-all transform hover:scale-[1.02] active:scale-95"
                      on:click={async () => {
                          try {
                              showDeleteAccountModal = false;
                              const { error } = await supabase.from('profiles').delete().eq('id', currentUser.id);
                              if (error) throw error;
                              await supabase.auth.signOut();
                              window.location.href = '/auth/login';
                          } catch(err) {
                              alert('Error deleting account: ' + err.message);
                              showDeleteAccountModal = false;
                          }
                      }}
                  >
                      Yes, Delete Everything
                  </button>
                  <button 
                      class="w-full py-3 text-gray-500 font-medium text-sm hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                      on:click={() => showDeleteAccountModal = false}
                  >
                      Cancel
                  </button>
              </div>
          </div>
      </div>
  </div>
  {/if}

  <!-- Remove Member Confirmation Modal -->
  {#if showRemoveMemberModal && memberToRemove}
  <div class="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button type="button" class="absolute inset-0 bg-black/50 backdrop-blur-sm" on:click={() => { showRemoveMemberModal = false; memberToRemove = null; }}></button>
      <div class="bg-white rounded-[28px] p-6 w-full max-w-sm shadow-2xl relative z-10">
          <div class="text-center">
              <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                  </svg>
              </div>
              <h3 class="text-xl font-bold text-gray-900 mb-2">Remove {memberToRemove.first_name}?</h3>
              <p class="text-gray-500 text-sm mb-6">They will lose access to this household and its pets.</p>
              <div class="flex space-x-3">
                  <button class="flex-1 py-3 bg-gray-100 rounded-xl font-semibold text-gray-600 hover:bg-gray-200" on:click={() => { showRemoveMemberModal = false; memberToRemove = null; }}>Cancel</button>
                  <button class="flex-1 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600" on:click={removeMember}>Remove</button>
              </div>
          </div>
      </div>
  </div>
  {/if}

  <!-- Leave Household Confirmation Modal -->
  {#if showLeaveHouseholdModal}
  <div class="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button type="button" class="absolute inset-0 bg-black/50 backdrop-blur-sm" on:click={() => showLeaveHouseholdModal = false}></button>
      <div class="bg-white rounded-[28px] p-6 w-full max-w-sm shadow-2xl relative z-10">
          <div class="text-center">
              <div class="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
              </div>
              <h3 class="text-xl font-bold text-gray-900 mb-2">Leave this household?</h3>
              <p class="text-gray-500 text-sm mb-6">You will lose access to all pets and schedules in this household.</p>
              <div class="flex space-x-3">
                  <button class="flex-1 py-3 bg-gray-100 rounded-xl font-semibold text-gray-600 hover:bg-gray-200" on:click={() => showLeaveHouseholdModal = false}>Cancel</button>
                  <button class="flex-1 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600" on:click={leaveHousehold}>Leave</button>
              </div>
          </div>
      </div>
  </div>
  {/if}

  <!-- Delete Household Confirmation Modal -->
  {#if showDeleteHouseholdModal}
  <div class="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button type="button" class="absolute inset-0 bg-black/50 backdrop-blur-sm" on:click={() => showDeleteHouseholdModal = false}></button>
      <div class="bg-white rounded-[28px] p-6 w-full max-w-sm shadow-2xl relative z-10">
          <div class="text-center">
              <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
              </div>
              <h3 class="text-xl font-bold text-gray-900 mb-2">Delete Household?</h3>
              <p class="text-gray-500 text-sm mb-6">This will permanently delete all pets, schedules, and history. This action cannot be undone.</p>
              <div class="flex space-x-3">
                  <button class="flex-1 py-3 bg-gray-100 rounded-xl font-semibold text-gray-600 hover:bg-gray-200" on:click={() => showDeleteHouseholdModal = false}>Cancel</button>
                  <button class="flex-1 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600" on:click={deleteHousehold}>Delete</button>
              </div>
          </div>
      </div>
  </div>
  {/if}

  <!-- Create Household Modal -->
  {#if showCreateHouseholdModal}
  <div class="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button type="button" class="absolute inset-0 bg-black/50 backdrop-blur-sm" on:click={() => showCreateHouseholdModal = false}></button>
      <div class="bg-white rounded-[28px] p-6 w-full max-w-sm shadow-2xl relative z-10">
          <div class="text-center mb-6">
              <div class="w-16 h-16 bg-brand-sage/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-brand-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
              </div>
              <h3 class="text-xl font-bold text-gray-900">Create New Household</h3>
          </div>
          
          <div class="mb-6">
              <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Household Name</label>
              <input 
                  type="text" 
                  bind:value={newHouseholdName}
                  placeholder="e.g., Beach House, Mom's Place..."
                  class="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-sage focus:border-transparent"
              />
          </div>
          
          <div class="flex space-x-3">
              <button class="flex-1 py-3 bg-gray-100 rounded-xl font-semibold text-gray-600 hover:bg-gray-200" on:click={() => showCreateHouseholdModal = false}>Cancel</button>
              <button 
                  class="flex-1 py-3 bg-brand-sage text-white rounded-xl font-semibold hover:bg-brand-sage/90 disabled:opacity-50" 
                  on:click={createNewHousehold}
                  disabled={!newHouseholdName.trim()}
              >Create</button>
          </div>
      </div>
  </div>
  {/if}

  <!-- Cannot Delete Modal -->
  {#if showCannotDeleteModal}
  <div class="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button type="button" class="absolute inset-0 bg-black/50 backdrop-blur-sm" on:click={() => showCannotDeleteModal = false}></button>
      <div class="bg-white rounded-[28px] p-6 w-full max-w-sm shadow-2xl relative z-10 animate-scale-in">
          <div class="text-center mb-6">
              <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
              </div>
              <h3 class="text-xl font-bold text-gray-900">Cannot Delete Household</h3>
              <p class="text-gray-500 text-sm mt-2">
                  Please remove all other <strong>members</strong> and <strong>pets</strong> from this household first.
              </p>
          </div>
          
          <button 
              class="w-full py-3 bg-brand-sage text-white rounded-xl font-bold hover:bg-brand-sage/90 transition-colors shadow-lg shadow-brand-sage/20 active:scale-95 transform"
              on:click={() => showCannotDeleteModal = false}
          >
              Got it
          </button>
      </div>
  </div>
  {/if}

  <!-- Edit Household Modal -->
  {#if showEditHouseholdModal}
  <div class="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button type="button" class="absolute inset-0 bg-black/50 backdrop-blur-sm" on:click={() => showEditHouseholdModal = false}></button>
      <div class="bg-white rounded-[28px] p-6 w-full max-w-sm shadow-2xl relative z-10 animate-scale-in">
          <div class="text-center mb-6">
              <h3 class="text-xl font-bold text-gray-900">Rename Household</h3>
          </div>
          
          <div class="mb-6">
              <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Household Name</label>
              <input 
                  type="text" 
                  bind:value={editingHousehold.name}
                  class="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-sage focus:border-transparent"
              />
          </div>
          
          <div class="flex space-x-3">
              <button class="flex-1 py-3 bg-gray-100 rounded-xl font-semibold text-gray-600 hover:bg-gray-200" on:click={() => showEditHouseholdModal = false}>Cancel</button>
              <button 
                  class="flex-1 py-3 bg-brand-sage text-white rounded-xl font-semibold hover:bg-brand-sage/90 disabled:opacity-50" 
                  on:click={updateHouseholdName}
                  disabled={!editingHousehold?.name.trim()}
              >Save</button>
          </div>
      </div>
  </div>
  {/if}

</div>


