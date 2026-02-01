<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import type { Database } from '$lib/database.types';
  import { APP_VERSION } from '$lib/version';
  import { onboarding } from '$lib/stores/onboarding';

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
  let isPremium = false;
  let canInvite = false;

  // Invite state
  let showInviteModal = false;
  let inviteEmail = '';
  
  let showEditProfileModal = false;
  let profile = {
      first_name: '',
      last_name: '',
      phone: '',
      username: '',
      email: ''
  };
  let error = '';

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

        // 1. Get my membership to find household
        const { data: myMember, error: myError } = await supabase
            .from('household_members')
            .select('household_id')
            .eq('user_id', currentUser.id)
            .single();
            
        if (myError) throw myError;
        householdId = myMember.household_id;

        // 2. Check if I am owner AND get subscription status
        const { data: household, error: hhError } = await supabase
            .from('households')
            .select('owner_id, subscription_status')
            .eq('id', householdId)
            .single();
            
        if (hhError) throw hhError;
        isOwner = household.owner_id === currentUser.id;
        isPremium = household.subscription_status === 'active';

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
            email: m.profiles?.email || '',
            can_log: m.can_log,
            can_edit: m.can_edit,
            is_active: m.is_active
        }));
        
        // Monetization Check: Free tier limit is 2 members
        const MEMBER_LIMIT = 2;
        
        // Update component state
        isPremium = household.subscription_status === 'active';
        canInvite = isPremium || members.length < MEMBER_LIMIT;
        
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



  import QRCode from 'qrcode';
  let qrCodeDataUrl = '';
  let inviteUrl = '';
  let showPremiumModal = false;
  let showDeleteAccountModal = false;

  async function generateInvite() {
      if (!householdId) return;
      
      // Monetization Gate
      if (!canInvite) {
          showPremiumModal = true;
          return;
      }
      
      try {
          // Check if key exists
          const { data: existingKey } = await supabase
             .from('household_keys')
             .select('key_value')
             .eq('household_id', householdId)
             .maybeSingle();

          let inviteKey = existingKey?.key_value;

          if (!inviteKey) {
             // Create new key
             inviteKey = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
             const { error: createError } = await supabase
                 .from('household_keys')
                 .insert({
                     household_id: householdId,
                     key_value: inviteKey,
                     expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
                 });
             if (createError) throw createError;
          }

          // Generate URL
          const origin = window.location.origin;
          const url = `${origin}/join?k=${inviteKey}`;
          inviteUrl = url;
          qrCodeDataUrl = await QRCode.toDataURL(url, {
              width: 256,
              margin: 2,
              color: {
                  dark: '#2f4f4f', // Brand Sage Darker
                  light: '#ffffff'
              }
          });
          
          showInviteModal = true;

      } catch (err: any) {
          console.error('Error generating invite:', err);
          alert('Failed to generate invite');
      }
  }
  
  async function handleExportData() {
      if (!isPremium) {
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
      <section class="bg-white rounded-2xl overflow-hidden shadow-sm" data-tour="settings-family">
         <div class="p-4 border-b border-gray-100 flex items-center justify-between">
             <div>
                <div class="flex items-center space-x-2">
                    <div class="font-bold text-gray-900">Family & Access</div>
                    <button 
                        class="text-gray-400 hover:text-brand-sage transition-colors"
                        on:click={() => onboarding.showTooltip('add-family')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </button>
                </div>
                <p class="text-xs text-gray-500">Manage who can access this home.</p>
             </div>
             <button 
                class="bg-brand-sage/10 text-brand-sage p-2 rounded-full hover:bg-brand-sage/20 transition-colors"
                on:click={generateInvite}
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

      <!-- Pets Section -->
      <section class="bg-white rounded-2xl overflow-hidden shadow-sm">
         <div class="p-4 border-b border-gray-100 flex items-center justify-between">
             <div>
                <div class="font-bold text-gray-900">My Pets</div>
                <p class="text-xs text-gray-500">Manage names, icons & details.</p>
             </div>
             {#if isPremium || pets.length < 2}
                 <!-- Add Pet Button (Navigates to Add Page) -->
                 <button 
                    class="bg-brand-sage/10 text-brand-sage p-2 rounded-full hover:bg-brand-sage/20 transition-colors"
                    on:click={() => goto('/pets/add')}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                    </svg>
                </button>
             {/if}
         </div>

         {#if loading}
              <div class="p-4 text-center text-gray-400">Loading pets...</div>
         {:else}
              <div class="divide-y divide-gray-100">
                  {#each pets as pet}
                     <div class="p-4 flex items-center justify-between">
                         <div class="flex items-center space-x-3">
                             <div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-3xl shadow-sm border-2 border-white overflow-hidden">
                                 <PetIcon icon={pet.icon} size="md" />
                             </div>
                             <div>
                                 <div class="font-bold text-gray-900 text-base">{pet.name}</div>
                                 <div class="text-xs text-brand-sage font-bold uppercase tracking-wide">{pet.species}</div>
                             </div>
                         </div>
 
                         <!-- Edit Button -->
                         <button 
                             class="p-2 text-gray-300 hover:text-brand-sage transition-colors rounded-full hover:bg-gray-50"
                             on:click={() => openEditPet(pet)}
                         >
                             <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                             </svg>
                         </button>
                     </div>
                  {/each}
              </div>
         {/if}
      </section>

      <!-- Account & General -->
      <section class="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100" data-tour="settings-preferences">
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

       <section class="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100" data-tour="settings-premium">
         <div class="p-4">
             <div class="font-bold text-gray-900 mb-2">Subscription</div>
             <div class="flex items-center justify-between">
                 <div>
                     <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold {isPremium ? 'bg-brand-sage/10 text-brand-sage' : 'bg-gray-100 text-gray-600'}">
                        {isPremium ? 'PREMIUM HOUSEHOLD' : 'FREE TIER'}
                     </span>
                 </div>
                 <!-- DEV ONLY: Toggle -->
                 <button 
                    class="text-xs text-blue-500 hover:underline"
                    on:click={async () => {
                        try {
                            const newStatus = isPremium ? 'free' : 'active';
                            console.log('Toggling subscription to:', newStatus);
                            
                            const { data: updatedRows, error: updateError } = await supabase
                                .from('households')
                                .update({ subscription_status: newStatus })
                                .eq('id', householdId)
                                .select();

                            if (updateError) {
                                console.error('Toggle failed:', updateError);
                                alert('Failed to toggle status: ' + updateError.message);
                            } else if (!updatedRows || updatedRows.length === 0) {
                                console.error('Toggle updated 0 rows.');
                                alert('Toggle failed: No rows updated. Permission blocked?');
                            } else {
                                const row = updatedRows[0];
                                if (row.subscription_status !== newStatus) {
                                    alert(`Update IGNORED by Database!\nWe sent: '${newStatus}'\nDB kept: '${row.subscription_status}'\n\nThis confirms RLS policies prevent client-side billing updates (Security!).\n\nTo test: Create a NEW account (defaults to Free) or edit the DB manually.`);
                                } else {
                                    console.log('Toggle success, reloading...');
                                    window.location.reload();
                                }
                            }
                        } catch (e) {
                            console.error(e);
                            alert('Error: ' + e.message);
                        }
                    }}
                 >
                    [Dev: Toggle]
                 </button>
             </div>
             {#if !isPremium}
                <p class="text-xs text-gray-400 mt-2">Limits: 1 Pet, 2 Members, 3 History Items</p>
             {/if}
         </div>
       </section>
       
       <section class="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
          <div class="p-4">
              <div class="font-bold text-gray-900 mb-2">About</div>
              <div class="space-y-1">
                  <a href="/legal/privacy" class="flex items-center justify-between py-2 text-sm text-gray-500 hover:text-brand-sage transition-colors">
                      <span>Privacy Policy</span>
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                  </a>
                  <a href="/legal/tos" class="flex items-center justify-between py-2 text-sm text-gray-500 hover:text-brand-sage transition-colors">
                      <span>Terms of Service</span>
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                  </a>
              </div>
              <div class="mt-4 pt-4 border-t border-gray-50">
                  <p class="text-[10px] text-center text-gray-400">
                      Made with ❤️ for Pets everywhere.
                  </p>
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
           
           <div class="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer border-t border-gray-100" on:click={handleExportData}>
              <div class="flex items-center space-x-3 text-gray-700">
                 <div class="p-2 bg-green-50 text-green-600 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                 </div>
                 <div class="flex flex-col">
                     <span class="font-medium text-sm">Export Data</span>
                     {#if !isPremium}
                        <span class="text-[10px] text-brand-sage font-bold uppercase tracking-wide">Premium</span>
                     {/if}
                 </div>
              </div>
          </div>
          
          <div class="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer border-t border-gray-100" on:click={handleLogout}>
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
         <div class="flex items-center justify-between p-4 hover:bg-red-50 transition-colors cursor-pointer border-t border-gray-100" 
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

       <!-- Version Display -->
       <div class="text-center pb-8">
           <p class="text-xs text-gray-400 font-mono">v{APP_VERSION}</p>
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
                            if (isPremium) {
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
                       {#if !isPremium}
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
               
               <button 
                   class="w-full mt-2 py-4 text-red-500 font-bold rounded-xl hover:bg-red-50 transition-colors"
                   on:click={deletePet}
               >
                   Delete Pet
               </button>
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
             
             <div class="flex flex-col items-center justify-center py-4 space-y-4">
                 <div class="w-48 h-48 bg-white rounded-lg flex items-center justify-center border-2 border-dashed border-gray-200">
                    {#if qrCodeDataUrl}
                        <img src={qrCodeDataUrl} alt="Invite QR Code" class="w-full h-full object-contain" />
                    {:else}
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-gray-300 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                     </svg>
                    {/if}
                 </div>
                 
                 {#if inviteUrl}
                    <a href={inviteUrl} target="_blank" class="text-brand-sage text-sm font-bold hover:underline">
                        Test Link (Click Me)
                    </a>
                 {/if}
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

</div>
