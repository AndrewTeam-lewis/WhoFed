<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import type { Database } from '$lib/database.types';
  import { APP_VERSION } from '$lib/version';
  import { onboarding } from '$lib/stores/onboarding';
  import { activeHousehold, availableHouseholds, switchHousehold } from '$lib/stores/appState';
  import { userIsPremium } from '$lib/stores/user';
  import CreateHouseholdModal from '$lib/components/CreateHouseholdModal.svelte';
  import InviteMemberModal from '$lib/components/InviteMemberModal.svelte';
  import PremiumFeatureModal from '$lib/components/PremiumFeatureModal.svelte';
  import AddPetModal from '$lib/components/AddPetModal.svelte';
  import ChangePasswordModal from '$lib/components/ChangePasswordModal.svelte';
  import ChangeEmailModal from '$lib/components/ChangeEmailModal.svelte';
  import PetIcon from '$lib/components/PetIcon.svelte';
  import NotificationsModal from '$lib/components/NotificationsModal.svelte';
  import { notificationService } from '$lib/services/notifications';
  import { purchasesService, currentOfferings } from '$lib/services/purchases';
  // Import the new modal
  import ExportOptionsModal from '$lib/components/ExportOptionsModal.svelte';

  let showExportOptionsModal = false;
  let allPets: any[] = [];

  async function openExportModal() {
      if (!$userIsPremium) {
          showPremiumModal = true;
          return;
      }
      
      // Fetch ALL pets across all households for the export dropdown
      try {
          const householdIds = $availableHouseholds.map(h => h.id);
          if (householdIds.length > 0) {
              const { data, error } = await supabase
                  .from('pets')
                  .select('id, name, household_id')
                  .in('household_id', householdIds)
                  .order('name');
              
              if (!error && data) {
                  allPets = data;
              }
          }
      } catch (e) {
          console.error('Error fetching export pets', e);
      }

      showExportOptionsModal = true;
  }
  
  // Clean up old function if referenced in template, verify template updation next


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
  let showManageRemindersModal = false; // New: Granular management
  let notificationSettings: Record<string, boolean> = {}; // schedule_id -> is_enabled
  let reminderSchedules: any[] = []; // List of all schedules with pet info
  let pendingInviteCount = 0;
  let sentInviteCount = 0; // [NEW] Count for outgoing invites
  let incomingInvites: any[] = []; // [NEW] Actual data
  let outgoingInvites: any[] = []; // [NEW] Actual data
  let expandedInvitations = false; // [NEW] Toggle state
  let processingInviteId: string | null = null; // [NEW] Loading state

  let showEditProfileModal = false;
  let profile = {
      first_name: '',
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
  let notificationsEnabled = false;

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
  
  // Security State (Added to fix build)
  let showChangePasswordModal = false;
  let showChangeEmailModal = false;
  
  // Monetization Limits
  const FREE_HOUSEHOLDS_LIMIT = 1;

  $: ownedHouseholdsCount = $availableHouseholds.filter(h => h.role === 'owner').length;
  $: canAddHousehold = $userIsPremium || ownedHouseholdsCount < FREE_HOUSEHOLDS_LIMIT;
  
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

  // Aliases and missing handlers for syntax check
  const savePetEdits = savePet;

  async function deletePet() {
      if (!confirm('Are you sure you want to delete this pet? This cannot be undone.')) return;
      loading = true;
      try {
          const { error } = await supabase
              .from('pets')
              .delete()
              .eq('id', editingPet.id);
          
          if (error) throw error;
          showEditPetModal = false;
          await loadSettings();
      } catch (e: any) {
          alert('Error deleting pet: ' + e.message);
      } finally {
          loading = false;
      }
  }

  async function handleFileUpload(event: Event) {
       const input = event.target as HTMLInputElement;
       if (!input.files?.length) return;
       // Logic to upload custom icon would go here.
       // For now, simple alert or ignore as we use emoji picker primarily.
       alert("Custom photo upload coming soon!");
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

  function handleCreateHousehold(event: CustomEvent) {
      showCreateHouseholdModal = false;
      // Force reload to pick up new household in layout
      window.location.reload();
  }

  onMount(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      goto('/auth/login');
      return;
    }
    currentUser = session.user;

    await loadSettings();
    
    // Check notification status
    notificationsEnabled = await notificationService.checkSubscriptionState();
  });

  async function openManageReminders() {
      // Changed: Fetch for ALL households I am in
      loading = true;
      try {
          // 1. Get my households
          const { data: myHHs } = await supabase.from('household_members').select('household_id').eq('user_id', currentUser.id);
          const hhIds = myHHs?.map(h => h.household_id) || [];
          
          
          if (hhIds.length === 0) {
            reminderSchedules = [];
            showManageRemindersModal = true;
            return;
          }

          // 2. Get Households Info (for grouping)
          const { data: households } = await supabase.from('households').select('id, name').in('id', hhIds);
          
          // 3. Get all pets in these households
          const { data: myPets, error: petsError } = await supabase
            .from('pets')
            .select('id, name, icon, species, household_id')
            .in('household_id', hhIds);
          
          if (petsError) throw petsError;
          const petIds = myPets.map(p => p.id);

          // 4. Get all schedules for these pets
          const { data: scheds, error: schedError } = await supabase
            .from('schedules')
            .select('*')
            .in('pet_id', petIds)
            .eq('is_enabled', true); 
          
          if (schedError) throw schedError;

          // 4. Get my personal reminder settings
          const { data: settings, error: setError } = await supabase
            .from('reminder_settings')
            .select('schedule_id, is_enabled')
            .eq('user_id', currentUser.id);

          if (setError) throw setError;

          // 5. Build State
          const settingsMap: Record<string, boolean> = {};
          settings?.forEach(s => settingsMap[s.schedule_id] = s.is_enabled);

          notificationSettings = settingsMap;

          // Combine schedules with pet and household info
          reminderSchedules = scheds.map(s => {
              const pet = myPets.find(p => p.id === s.pet_id);
              const hh = households?.find(h => h.id === pet?.household_id);
              return {
                  ...s,
                  pet: pet,
                  household_name: hh?.name || 'Unknown Household',
                  // Fallback title logic
                  display_label: s.label || (s.task_type === 'medication' ? 'Medication' : s.task_type === 'litter' ? 'Change Litter' : 'Feeding'),
                  my_enabled: settingsMap[s.id] !== undefined ? settingsMap[s.id] : true
              };
          });

          // Sort by Household Name, then Pet Name, then Time
          reminderSchedules.sort((a, b) => {
              if (a.household_name !== b.household_name) return a.household_name.localeCompare(b.household_name);
              if (a.pet?.name !== b.pet?.name) return (a.pet?.name || '').localeCompare(b.pet?.name || '');
              return (a.target_times?.[0] || '').localeCompare(b.target_times?.[0] || '');
          });

          showManageRemindersModal = true;
      } catch (e: any) {
          alert('Error loading reminders: ' + e.message);
      } finally {
          loading = false;
      }
  }

  async function toggleReminder(scheduleId: string) {
      const currentVal = notificationSettings[scheduleId] !== undefined ? notificationSettings[scheduleId] : true;
      const newVal = !currentVal;

      // Optimistic update
      notificationSettings[scheduleId] = newVal;
      // Update the list view too
      reminderSchedules = reminderSchedules.map(s => s.id === scheduleId ? { ...s, my_enabled: newVal } : s);

      try {
          // Upsert to DB
          const { error } = await supabase
            .from('reminder_settings')
            .upsert({ 
                user_id: currentUser.id, 
                schedule_id: scheduleId, 
                is_enabled: newVal 
            }, { onConflict: 'user_id, schedule_id' });

          if (error) throw error;
      } catch (e: any) {
          console.error("Failed to save reminder setting", e);
          // Revert on error
          notificationSettings[scheduleId] = currentVal;
          reminderSchedules = reminderSchedules.map(s => s.id === scheduleId ? { ...s, my_enabled: currentVal } : s);
      }
  }

  async function toggleNotifications() {
      try {
          if (notificationsEnabled) {
              // Disable
              await notificationService.unsubscribeFromPush();
              notificationsEnabled = false;
          } else {
              // Enable
              await notificationService.subscribeToPush();
              notificationsEnabled = true;
          }
      } catch (e: any) {
          alert('Notification Error: ' + e.message);
          // Revert Toggle if failed
          notificationsEnabled = !notificationsEnabled;
      }
  }

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
            // Prioritize Auth email (source of truth)
            const realEmail = currentUser.email || '';
            const profileEmail = myProfile.email || '';
            
            profile = {
                first_name: myProfile.first_name || '',
                email: realEmail || profileEmail // Use auth email if available
            };

            // Lazy Sync: If auth email changed but profile is stale, update it
            if (realEmail && realEmail !== profileEmail) {
                console.log('Syncing profile email to auth email...');
                supabase.from('profiles').update({ email: realEmail }).eq('id', currentUser.id).then(({ error }) => {
                   if (error) console.error('Failed to sync profile email:', error);
                });
            }
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
                profiles (first_name, email)
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

        // 5. Get pending invite count for current user (INCOMING)
        const { data: incInvites, error: incError } = await supabase
            .from('household_invitations')
            .select(`
                id,
                household_id,
                created_at,
                households (name),
                profiles!household_invitations_invited_by_fkey (first_name, last_name, email)
            `)
            .eq('invited_user_id', currentUser.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (incError) console.error('Error fetching incoming invites:', incError);
        incomingInvites = incInvites || [];
        pendingInviteCount = incomingInvites.length;

        // 6. Get pending invite count sent BY me (OUTGOING)
        const { data: outInvites, error: outError } = await supabase
            .from('household_invitations')
            .select(`
                id,
                household_id,
                created_at,
                status,
                households (name),
                profiles!household_invitations_invited_user_id_fkey (first_name, last_name, email, username)
            `)
            .eq('invited_by', currentUser.id)
            .order('created_at', { ascending: false });

        if (outError) console.error('Error fetching outgoing invites:', outError);
        outgoingInvites = outInvites || [];
        // Count only pending/active ones if desired, or all? User asked for "sent invitations that have not been accepted".
        // Let's filter for display logic but keep data.
        sentInviteCount = outgoingInvites.filter(i => i.status === 'pending').length;
        
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
            .eq('household_id', householdId || '');

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
  


  async function handleLogout() {
      try {
          console.log('Logging out...');
          await supabase.auth.signOut();
          console.log('Signed out, redirecting...');
          window.location.href = '/'; 
      } catch (e) {
          console.error('Logout failed:', e);
          // Force redirect anyway
          window.location.href = '/';
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
          // Stay on settings page, just refresh to update lists
          window.location.reload();
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

 



  async function acceptInvite(inviteId: string) {
      if (!inviteId) return;
      processingInviteId = inviteId;
      console.log('Accepting invite:', inviteId);
      
      try {
          // Use RPC that handles everything
          const { data, error } = await supabase.rpc('accept_household_invite', { p_invite_id: inviteId });
          
          if (error) {
              console.error('RPC Error:', error);
              throw error;
          }
           
          // Handle cases where RPC returns error object
          if (data && typeof data === 'object' && 'success' in data && !data.success) {
               throw new Error((data as any).error || 'Failed to join household');
          }

          // Reload to refresh all data (simplest way to sync state)
          window.location.reload();
      } catch (e: any) {
          console.error('Error in acceptInvite:', e);
          alert('Error accepting invite: ' + e.message);
          processingInviteId = null;
      }
  }

  async function declineInvite(inviteId: string) {
      if (!confirm('Are you sure you want to decline?')) return;
      processingInviteId = inviteId;
      try {
          const { error } = await supabase.from('household_invitations').update({ status: 'declined' }).eq('id', inviteId);
          if (error) throw error;
          
          // Refresh list locally
          incomingInvites = incomingInvites.filter(i => i.id !== inviteId);
          pendingInviteCount = incomingInvites.length;
      } catch (e: any) {
          console.error('Error declining invite:', e);
          alert('Failed to decline invite');
      } finally {
          processingInviteId = null;
      }
  }

  async function revokeInvite(inviteId: string) {
      if (!confirm('Revoke this invitation?')) return;
      try {
          const { error } = await supabase.from('household_invitations').delete().eq('id', inviteId);
          if (error) throw error;
          
          outgoingInvites = outgoingInvites.filter(i => i.id !== inviteId);
          sentInviteCount = Math.max(0, sentInviteCount - 1);
      } catch (e: any) {
          alert('Error: ' + e.message);
      }
  }

</script>

<!-- Build fix applied: 2026-02-08 -->

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
       <!-- Bell removed -->
    </div>
  </header>

  <main class="p-6 max-w-lg mx-auto space-y-6">
      <!-- Profile Settings (Editable via Modal) -->
       <div class="space-y-2">
         <div class="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Personal Identity</div>
         <!-- Profile Card -->
         <section class="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
             <div class="flex items-center justify-between p-6">
                 <h2 class="text-xl font-bold text-gray-900">{profile.first_name}</h2>
                 <button 
                     class="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200 transition-colors rounded-full"
                     on:click={() => showEditProfileModal = true}
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                     </svg>
                 </button>
             </div>

              <!-- Email Row (Read Only) -->
             <div class="w-full text-left p-4 flex items-center justify-between">
                 <div>
                     <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Primary Email</p>
                     <p class="text-sm font-medium text-gray-900">{profile.email || 'No email set'}</p>
                 </div>
                 <!-- <div class="flex items-center text-brand-sage font-medium text-xs">
                     <span>Change</span>
                 </div> -->
             </div>
             
             <!-- Password Row -->
             <button class="w-full text-left p-4 flex items-center justify-between hover:bg-gray-50 transition-colors" on:click={() => showChangePasswordModal = true}>
                 <div>
                     <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Password</p>
                     <p class="text-sm font-bold text-gray-900 tracking-widest">••••••••••••</p>
                 </div>
                 <div class="flex items-center text-brand-sage font-medium text-xs">
                     <span>Change</span>
                 </div>
             </button>
         </section>
          <p class="text-xs text-gray-400 px-1 leading-relaxed mt-2">
              Changes to sensitive information may require a secondary verification step to ensure your account's safety.
          </p>
       </div>



      <!-- Account & General (Moved here) -->

       <!-- Households -->
       <div class="space-y-2">
         <div class="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Households</div>
         <section class="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
             
             <!-- Header / Action -->
             <div class="p-4 flex items-center justify-between">
                 <div>
                     <h3 class="font-bold text-gray-900 leading-tight">Manage Households</h3>
                     <p class="text-xs text-gray-500 mt-1">Manage your households and access levels.</p>
                 </div>
                 <button 
                     class="w-8 h-8 rounded-full flex items-center justify-center transition-colors {canAddHousehold ? 'bg-brand-sage/10 text-brand-sage hover:bg-brand-sage/20' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}"
                     on:click={() => {
                        if (canAddHousehold) {
                            showCreateHouseholdModal = true;
                        } else {
                            showPremiumModal = true;
                        }
                     }}
                     title={canAddHousehold ? "Create new household" : "Limit reached (Free Tier)"}
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                         <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd" />
                     </svg>
                 </button>
             </div>

             <!-- Households List -->
             {#each $availableHouseholds as hh}
                 <div>
                     <div role="button" tabindex="0" on:keydown={(e) => e.key === "Enter" && toggleHouseholdAccordion(hh.id)} 
                         class="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors cursor-pointer"
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
                     </div>
 
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
                                                         <div class="text-[10px]  font-bold {member.role === 'owner' ? 'text-brand-sage' : 'text-gray-400'}">
                                                             {member.role === 'owner' ? 'Owner' : 'Member'}
                                                         </div>
                                                     </div>
                                                 </div>
                                                 
                                                 <!-- Actions -->
                                                 <div class="flex items-center space-x-1">
                                                     {#if hh.role === 'owner' && member.user_id !== currentUser?.id}
                                                             <button 
                                                             class="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                                             on:click={() => { memberToRemove = { ...member, first_name: member.first_name || 'Member' }; householdIdForAction = hh.id; showRemoveMemberModal = true; }}
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
                                 
                                 <!-- Invite Member -->
                                 {#if hh.role === 'owner'}
                                     <div class="mt-4 pt-3 border-t border-gray-100">
                                         <button 
                                             class="flex items-center justify-center w-full py-2.5 rounded-xl text-xs font-bold transition-all {canInvite ? 'bg-brand-sage/10 text-brand-sage hover:bg-brand-sage/20' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}"
                                             on:click={() => {
                                                 if (canInvite) {
                                                     inviteHouseholdId = hh.id; 
                                                     showInviteMemberModal = true;
                                                 } else {
                                                     showPremiumModal = true;
                                                 }
                                             }}
                                         >
                                             <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                             </svg>
                                             {canInvite ? 'Invite Member' : 'Member Limit Reached'}
                                         </button>
                                     </div>
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


       <!-- [NEW] Invitations Accordion -->
       <div class="space-y-2">
         <section class="bg-white rounded-2xl overflow-hidden shadow-sm">
             <button 
                class="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors relative overflow-hidden text-left"
                on:click={() => expandedInvitations = !expandedInvitations}
                aria-label="Toggle invitations"
             >
                <div class="flex items-center space-x-3 relative z-10">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-brand-sage/10 text-brand-sage">
                       <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                       </svg>
                    </div>
                    <div>
                        <div class="font-bold text-gray-900 text-sm">Invitations</div>
                        <div class="text-xs text-gray-500">
                            {#if pendingInviteCount > 0}
                                <span class="text-brand-sage font-bold">{pendingInviteCount} new</span> 
                            {:else if sentInviteCount > 0}
                                <span class="text-gray-400">View sent invites</span>
                            {:else}
                                <span class="text-gray-400">Manage invitations</span>
                            {/if}
                        </div>
                    </div>
                </div>

                <div class="flex items-center space-x-2">
                    {#if pendingInviteCount > 0 && !expandedInvitations}
                    <div class="relative w-3 h-3">
                        <div class="w-3 h-3 bg-red-500 rounded-full animate-ping absolute inset-0 opacity-75"></div>
                        <div class="w-3 h-3 bg-red-500 rounded-full relative"></div>
                    </div>
                    {/if}
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-300 transition-transform {expandedInvitations ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
             </button>

             <!-- Accordion Content -->
             {#if expandedInvitations}
                <div class="px-4 pb-4 pt-0 bg-gray-50/50 border-t border-gray-100">
                    
                    <!-- INCOMING -->
                    {#if incomingInvites.length > 0}
                        <div class="pt-4">
                            <div class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Received ({incomingInvites.length})</div>
                            <div class="space-y-2">
                                {#each incomingInvites as invite}
                                    <div class="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                                        <div class="flex items-start justify-between">
                                            <div>
                                                <div class="text-xs text-gray-500">
                                                    <span class="font-bold text-gray-900">{invite.profiles?.first_name || 'Someone'}</span> invited you to join <span class="font-bold text-gray-900">{invite.households?.name}</span>
                                                </div>
                                                <div class="text-[10px] text-gray-400 mt-1">
                                                    {new Date(invite.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div class="flex space-x-2 mt-3">
                                            <button 
                                                class="flex-1 py-1.5 bg-gray-100 text-gray-600 font-bold text-[10px] rounded-lg hover:bg-gray-200 transition-colors"
                                                on:click={() => declineInvite(invite.id)}
                                                disabled={processingInviteId === invite.id}
                                            >
                                                Decline
                                            </button>
                                            <button 
                                                class="flex-1 py-1.5 bg-brand-sage text-white font-bold text-[10px] rounded-lg shadow-sm hover:bg-brand-sage/90 transition-colors"
                                                on:click={() => acceptInvite(invite.id)}
                                                disabled={processingInviteId === invite.id}
                                            >
                                                {processingInviteId === invite.id ? 'Joining...' : 'Accept'}
                                            </button>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    <!-- OUTGOING (SENT) -->
                    {#if outgoingInvites.length > 0}
                        <div class="mt-4 pt-4 border-t border-gray-100">
                            <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Sent Invites</div>
                            <div class="space-y-2">
                                {#each outgoingInvites as invite (invite.id)}
                                    <div class="bg-white p-3 rounded-xl border border-gray-100 flex items-center justify-between">
                                        <div class="flex items-center space-x-3">
                                             <div class="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 font-bold text-xs">
                                                {(invite.profiles?.first_name?.[0] || invite.profiles?.username?.[0] || '?').toUpperCase()}
                                             </div>
                                             <div>
                                                 <div class="text-xs font-bold text-gray-900">
                                                     {invite.profiles?.first_name ? `${invite.profiles.first_name} ${invite.profiles.last_name || ''}` : `@${invite.profiles?.username || 'Unknown'}`}
                                                 </div>
                                                 <div class="text-[10px] text-gray-500">
                                                     Invited to: {invite.households?.name} • 
                                                     <span class="{invite.status === 'pending' ? 'text-orange-500' : (invite.status === 'accepted' ? 'text-green-500' : 'text-red-500')} font-bold capitalize">
                                                         {invite.status}
                                                     </span>
                                                 </div>
                                             </div>
                                        </div>
                                        
                                        <!-- Only allow revoking pending invites or remove declined/accepted ones to clear list -->
                                        <!-- Separate actions based on status -->
                                        {#if invite.status === 'pending'}
                                            <button 
                                                class="text-xs font-bold text-gray-400 hover:text-red-500 underline px-2 transition-colors disabled:opacity-50"
                                                on:click={() => revokeInvite(invite.id)}
                                                disabled={processingInviteId === invite.id}
                                            >
                                                {processingInviteId === invite.id ? '...' : 'Cancel'}
                                            </button>
                                        {:else}
                                            <button 
                                                class="text-gray-300 hover:text-gray-500 p-2 transition-colors disabled:opacity-50"
                                                on:click={() => revokeInvite(invite.id, true)} 
                                                disabled={processingInviteId === invite.id}
                                                aria-label="Remove from list"
                                            >
                                                {#if processingInviteId === invite.id}
                                                    <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                {:else}
                                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                {/if}
                                            </button>
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}


                    {#if incomingInvites.length === 0 && outgoingInvites.filter(i => i.status !== 'accepted').length === 0}
                        <div class="text-center py-6">
                            <p class="text-xs text-gray-400">No active invitations.</p>
                        </div>
                    {/if}

                </div>
             {/if}
         </section>
       </div>

      <!-- Notifications -->
      <div class="space-y-2 mb-8">
        <div class="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Preferences</div>
        <section class="bg-white rounded-2xl overflow-hidden shadow-sm">
           <div class="p-4 flex items-center justify-between">
               <div class="flex items-center space-x-3">
                   <div class="p-2 bg-brand-sage/10 text-brand-sage rounded-xl">
                       <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                       </svg>
                   </div>
                   <div class="flex flex-col">
                       <span class="font-bold text-sm text-gray-900">Push Notifications</span>
                       <span class="text-[10px] text-gray-400">Receive reminders on this device</span>
                   </div>
               </div>
               
               <button 
                  class="relative w-11 h-6 rounded-full transition-colors {notificationsEnabled ? 'bg-brand-sage' : 'bg-gray-200'}"
                  on:click={toggleNotifications}
               >
                   <span 
                       class="absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm {notificationsEnabled ? 'translate-x-5' : 'translate-x-0'}"
                   ></span>
               </button>
           </div>
           
           {#if notificationsEnabled}
           <div class="px-4 pb-4 bg-white border-t border-gray-100 mt-2 pt-3">
                <button 
                    class="w-full flex items-center justify-between text-left group"
                    on:click={openManageReminders}
                >
                    <div class="flex flex-col">
                        <span class="text-sm font-bold text-gray-700 group-hover:text-brand-sage transition-colors">Manage Schedule Alerts</span>
                        <span class="text-[10px] text-gray-400">Choose which schedules notify you</span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-300 group-hover:text-brand-sage transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
           </div>
           {/if}
        </section>
      </div>

       <!-- Test Notification Button (Hidden unless toggled?) No, explicit request -->
       {#if notificationsEnabled}

       {/if}



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
                  <span class="text-sm font-medium text-gray-900">Privacy Policy</span>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
              </a>
              <a href="/legal/tos" class="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                  <span class="text-sm font-medium text-gray-900">Terms of Service</span>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
              </a>
              <div class="flex items-center justify-between p-4 bg-gray-50/50">
                  <span class="text-sm font-medium text-gray-900">Version</span>
                  <span class="text-sm text-gray-500">{APP_VERSION}</span>
              </div>
          </section>
       </div>
       
       <div class="space-y-2">
          <section class="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
              <div class="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer" on:click={openExportModal}>
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
                 <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1" for="firstName">Display Name</label>
                    <input id="firstName" type="text" bind:value={profile.first_name} class="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-brand-sage outline-none" placeholder="Display Name" />
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
                  {#if $currentOfferings.length > 0}
                      {#each $currentOfferings as pkg}
                        <button 
                            class="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl shadow-xl hover:bg-black transition-all transform hover:scale-[1.02] active:scale-95 mb-2"
                            on:click={async () => {
                                const success = await purchasesService.purchase(pkg);
                                if (success) {
                                    showPremiumModal = false;
                                    alert("Welcome to Premium! 💎");
                                }
                            }}
                        >
                            Upgrade for {pkg.product.priceString} / {pkg.packageType === 'ANNUAL' ? 'year' : 'month'}
                        </button>
                      {/each}
                  {:else}
                       <button 
                          class="w-full py-4 bg-gray-200 text-gray-400 font-bold rounded-2xl cursor-not-allowed"
                          disabled
                      >
                          { $currentOfferings.length === 0 ? 'Loading Prices...' : 'No products found' }
                      </button>
                      <!-- Fallback/Debug -->
                      <button on:click={() => purchasesService.loadOfferings()} class="text-xs text-blue-500 mt-2 underline">Retry Loading</button>
                  {/if}
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
                          } catch(err: any) {
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
  <!-- Remove Member Modal -->
  {#if showRemoveMemberModal && memberToRemove}
  <div class="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button type="button" class="absolute inset-0 bg-black/50 backdrop-blur-sm" on:click={() => showRemoveMemberModal = false}></button>
      <div class="bg-white rounded-[28px] p-6 w-full max-w-sm shadow-2xl relative z-10 animate-scale-in">
          <div class="text-center">
              <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                  </svg>
              </div>
              <h3 class="text-xl font-bold text-gray-900 mb-2">Remove {memberToRemove.first_name}?</h3>
              <p class="text-gray-500 text-sm mb-6">They will lose access to all pets and schedules in this household.</p>
              <div class="flex space-x-3">
                  <button class="flex-1 py-3 bg-gray-100 rounded-xl font-semibold text-gray-600 hover:bg-gray-200" on:click={() => showRemoveMemberModal = false}>Cancel</button>
                  <button class="flex-1 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600" on:click={removeMember}>Remove</button>
              </div>
          </div>
      </div>
  </div>
  {/if}

  {#if showLeaveHouseholdModal}
  <div class="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button type="button" class="absolute inset-0 bg-black/50 backdrop-blur-sm" on:click={() => showLeaveHouseholdModal = false}></button>
      <div class="bg-white rounded-[28px] p-6 w-full max-w-sm shadow-2xl relative z-10 animate-scale-in">
          <div class="text-center">
              <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
              </div>
              <h3 class="text-xl font-bold text-gray-900 mb-2">Leave this household?</h3>
              <p class="text-gray-500 text-sm mb-6">You will lose access to all pets and schedules in this household.</p>
              <div class="flex space-x-3">
                  <button class="flex-1 py-3 bg-gray-100 rounded-xl font-semibold text-gray-600 hover:bg-gray-200" on:click={() => showLeaveHouseholdModal = false}>Cancel</button>
                  <button class="flex-1 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600" on:click={leaveHousehold}>Leave</button>
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

  <!-- Manage Reminders Modal -->
  {#if showManageRemindersModal}
  <div class="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <button type="button" class="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" on:click={() => showManageRemindersModal = false}></button>
      
      <div class="bg-white rounded-[32px] w-full max-w-sm relative z-10 animate-scale-in max-h-[80vh] flex flex-col">
          <div class="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                  <h3 class="text-xl font-bold text-gray-900">Manage Alerts</h3>
                  <p class="text-xs text-gray-400">Tap to toggle notification per schedule</p>
              </div>
              <button on:click={() => showManageRemindersModal = false} class="text-gray-400 hover:text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
              </button>
          </div>

          <div class="p-4 overflow-y-auto flex-1">
              {#if reminderSchedules.length === 0}
                 <div class="text-center py-10">
                     <p class="text-gray-400 font-medium">No active schedules found.</p>
                 </div>
              {:else}
                  <div class="space-y-6">
                      <!-- Group by Household unique keys -->
                      {#each [...new Set(reminderSchedules.map(r => r.household_name))] as hhName}
                          <div>
                              <div class="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">
                                  {hhName}
                              </div>
                              <div class="space-y-3">
                                  {#each reminderSchedules.filter(r => r.household_name === hhName) as sched (sched.id)}
                                      <div class="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                                          <div class="flex items-center space-x-3">
                                              <div class="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm">
                                                  {sched.pet?.icon || '🐾'}
                                              </div>
                                              <div>
                                                  <div class="font-bold text-gray-900 text-sm">{sched.display_label}</div>
                                                  <div class="text-[10px] text-gray-500 font-bold uppercase tracking-wide">
                                                      {sched.pet?.name} • {sched.target_times ? sched.target_times[0] : 'Daily'}
                                                  </div>
                                              </div>
                                          </div>
                                          
                                          <button 
                                              class="w-12 h-7 rounded-full transition-colors relative {sched.my_enabled ? 'bg-brand-sage' : 'bg-gray-200'}"
                                              on:click={() => toggleReminder(sched.id)}
                                          >
                                              <span class="absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transition-transform {sched.my_enabled ? 'translate-x-5' : 'translate-x-0'}"></span>
                                          </button>
                                      </div>
                                  {/each}
                              </div>
                          </div>
                      {/each}
                  </div>
              {/if}
          </div>
      </div>
  </div>
  {/if}


  <!-- Edit Household Modal -->
  {#if showEditHouseholdModal && editingHousehold}
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

  {#if showChangePasswordModal}
    <ChangePasswordModal on:close={() => showChangePasswordModal = false} />
  {/if}

  {#if showChangeEmailModal}
    <ChangeEmailModal 
        currentEmail={currentUser?.email || ''} 
        on:close={() => showChangeEmailModal = false} 
    />
  {/if}

  <ExportOptionsModal 
      bind:show={showExportOptionsModal} 
      households={$availableHouseholds}
      pets={allPets}
  />

  {#if showCreateHouseholdModal}
    <CreateHouseholdModal 
        on:close={() => showCreateHouseholdModal = false}
        on:create={handleCreateHousehold}
    />
  {/if}

</div>


