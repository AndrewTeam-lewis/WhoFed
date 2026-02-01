<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { generateTasksForDate } from '$lib/taskUtils';



  // Calendar State
  const today = new Date();
  let calendarMonth = today.getMonth();
  let calendarYear = today.getFullYear();

  // Dynamic Schedules
  type ScheduleItem = {
      id: string; 
      type: 'feeding' | 'medication' | 'litter';
      label: string;
      isEnabled: boolean;
      frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
      // Config for frequencies
      selectedDays: number[]; // 0-6 for Weekly (0=Sun)
      selectedDayOfMonth: number; // 1-31 for Monthly
      customDates: string[]; // YYYY-MM-DD strings for Custom
      times: { value: string, label: string }[];
  };

  let schedules: ScheduleItem[] = [
      { 
          id: '1', type: 'feeding', label: '', isEnabled: false, frequency: 'daily', 
          selectedDays: [], selectedDayOfMonth: 1, customDates: [], times: [{ value: '08:00', label: '' }, { value: '18:00', label: '' }] 
      },
      { 
          id: '2', type: 'medication', label: '', isEnabled: false, frequency: 'daily', 
          selectedDays: [], selectedDayOfMonth: 1, customDates: [], times: [{ value: '09:00', label: '' }] 
      }
  ];

  const DAYS_OF_WEEK = [
      { val: 1, label: 'M' }, { val: 2, label: 'T' }, { val: 3, label: 'W' },
      { val: 4, label: 'T' }, { val: 5, label: 'F' }, { val: 6, label: 'S' }, { val: 0, label: 'S' }
  ];

  // Icon Libraries
  const FREE_ICONS = ['🐶', '🐱', '🐰', '🐦', '🐠', '🐾', '🐕', '🐈', '🐹', '🐢'];
  const PREMIUM_ICONS = [
      '🦎', '🐍', '🦄', '🦖', '🦕', '🦂', '🕷️', '🐙', '🦑', '🦐', '🦞', '🦀', 
      '🐡', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', 
      '🦒', '🦘', '🐃', '🐏', '🦙', '🐐', '🦌', '🦇', '🦅', '🦆', '🦢', '🦉', 
      '🦩', '🦚', '🦜', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔',
      '🐉', '👽', '🤖', '👻', '🤡', '👹', '👺', '☠️', '💩', '👾', '🎃', '🦴'
  ];

  const QUICK_SPECIES = [
      { label: 'Dog', icon: '🐶' },
      { label: 'Cat', icon: '🐱' },
      { label: 'Bird', icon: '🐦' },
      { label: 'Hamster', icon: '🐹' },
      { label: 'Rabbit', icon: '🐰' },
      { label: 'Fish', icon: '🐠' },
      { label: 'Lizard', icon: '🦎' },
      { label: 'Snake', icon: '🐍' },
      { label: 'Turtle', icon: '🐢' }
  ];

  // State
  let loading = false;
  let name = '';
  let species = ''; // Now a text input
  let icon = '🐶'; // Default icon
  let householdId: string | null = null;
  let currentUser: any = null;
  let showIconModal = false; // Renamed from showSpeciesModal
  let showPremiumModal = false; 
  let isPremium = false; 
  let pushReminders = true;

  let scheduleNameEditingId: string | null = null;

  onMount(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      goto('/auth/login');
      return;
    }
    currentUser = session.user;
    
    // Get Household & Check Stats
    const { data: householdInfo, error: hhError } = await supabase
        .from('household_members')
        .select(`
            household_id,
            households (
                subscription_status
            )
        `)
        .eq('user_id', currentUser.id)
        .eq('is_active', true)
        .limit(1)
        .single();
    
    if (hhError && hhError.code !== 'PGRST116') { // Ignore "not found" so we can create one
        console.error('Error fetching household:', hhError);
        return;
    }

    if (householdInfo) {
        householdId = householdInfo.household_id;
        const subscriptionStatus = householdInfo.households?.subscription_status;
        isPremium = subscriptionStatus === 'active';
        

    } else {
        await createHousehold();
    }
  });

  async function createHousehold() {
      try {
          const { data: hh, error: hhError } = await supabase
            .from('households')
            .insert({ owner_id: currentUser.id })
            .select()
            .single();
            
          if (hhError) throw hhError;

          const { error: memError } = await supabase
            .from('household_members')
            .insert({ 
                household_id: hh.id, 
                user_id: currentUser.id,
                is_active: true,
                can_log: true,
                can_edit: true
            });

          if (memError) throw memError;
          householdId = hh.id;
      } catch (e: any) {
          console.error("Error creating household:", e);
      }
  }

  function addSchedule(type: 'feeding' | 'medication' | 'litter') {
      const id = Math.random().toString(36).substr(2, 9);
      schedules = [...schedules, {
          id,
          type,
          label: '',
          isEnabled: true,
          frequency: 'daily',
          selectedDays: [], 
          selectedDayOfMonth: 1, 
          customDates: [],
          times: [{ value: '08:00', label: '' }]
      }];
  }

  function removeSchedule(id: string) {
      schedules = schedules.filter(s => s.id !== id);
  }

  function addTime(scheduleId: string) {
      schedules = schedules.map(s => {
          if (s.id === scheduleId) {
              return { ...s, times: [...s.times, { value: '12:00', label: '' }] };
          }
          return s;
      });
  }

  function removeTime(scheduleId: string, timeIndex: number) {
      schedules = schedules.map(s => {
          if (s.id === scheduleId) {
              return { ...s, times: s.times.filter((_, i) => i !== timeIndex) };
          }
          return s;
      });
  }

  function toggleDay(schedule: ScheduleItem, day: number) {
      if (schedule.selectedDays.includes(day)) {
          schedule.selectedDays = schedule.selectedDays.filter(d => d !== day);
      } else {
          schedule.selectedDays = [...schedule.selectedDays, day];
      }
      schedules = [...schedules];
  }

  // Calendar Logic
  function getDaysInMonth(month: number, year: number) {
      return new Date(year, month + 1, 0).getDate();
  }

  function getMonthName(month: number) {
      return new Date(2000, month, 1).toLocaleString('default', { month: 'long' });
  }

  function toggleCalendarMonth(offset: number) {
      calendarMonth += offset;
      if (calendarMonth > 11) {
          calendarMonth = 0;
          calendarYear++;
      } else if (calendarMonth < 0) {
          calendarMonth = 11;
          calendarYear--;
      }
  }

  function toggleCustomDate(schedule: ScheduleItem, day: number) {
      const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      if (schedule.customDates.includes(dateStr)) {
          schedule.customDates = schedule.customDates.filter(d => d !== dateStr);
      } else {
          schedule.customDates = [...schedule.customDates, dateStr].sort();
      }
      schedules = [...schedules];
  }

  function isDateSelected(schedule: ScheduleItem, day: number) {
      const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return schedule.customDates.includes(dateStr);
  }

  async function handleSubmit() {
      if (!name || !householdId) {
          alert('Please enter a valid pet name.');
          return;
      }
      loading = true;

      try {
          // Monetization Check: Free Limit = 2 Pets (warn on 3rd)
          const PET_LIMIT = 2;
          if (!isPremium) {
              const { count, error: countError } = await supabase
                  .from('pets')
                  .select('*', { count: 'exact', head: true })
                  .eq('household_id', householdId);
                  
              if (!countError && (count || 0) >= PET_LIMIT) {
                  loading = false;
                  showPremiumModal = true; // Show modal instead of alert
                  return;
              }
          }

          // 1. Create Pet
          // Map UI species to DB species
          // The DB constraint likely allows 'dog', 'cat', etc. 
          // We need to map 'Dog 2', 'Cat 3' to basic types.
          let finalSpecies = species.trim().toLowerCase() || 'pet';
          
          if (finalSpecies.includes('dog')) finalSpecies = 'dog';
          else if (finalSpecies.includes('cat')) finalSpecies = 'cat';
          else if (finalSpecies.includes('bird')) finalSpecies = 'bird';
          else if (finalSpecies.includes('fish')) finalSpecies = 'fish';
          else if (finalSpecies.includes('rabbit')) finalSpecies = 'rabbit';
          else if (finalSpecies.includes('hamster')) finalSpecies = 'hamster';
          else if (finalSpecies.includes('lizard') || finalSpecies.includes('iguana')) finalSpecies = 'lizard';
          else if (finalSpecies.includes('snake')) finalSpecies = 'snake';
          else if (finalSpecies.includes('turtle')) finalSpecies = 'turtle';

      // 2. Insert Pet
      const { data: pet, error: petError } = await supabase
        .from('pets')
        .insert({
          name,
          species: species.toLowerCase(), // Allow mixed case input, strictly save as lowercase
          icon,
          household_id: householdId,
          created_by: currentUser.id
        })
        .select()
        .single();

          if (petError) throw petError;
          

          // 2. Validate Schedules
          for (const s of schedules) {
              if (s.isEnabled) {
                  if (s.frequency === 'weekly' && s.selectedDays.length === 0) {
                      loading = false;
                      alert(`Please select at least one day for schedule: ${s.label || s.type}`);
                      return;
                  }
                  if (s.frequency === 'custom' && s.customDates.length === 0) {
                      loading = false;
                      alert(`Please select at least one date for schedule: ${s.label || s.type}`);
                      return;
                  }
                  if (s.times.length === 0 && s.frequency !== 'monthly') {
                      loading = false;
                      alert(`Please add at least one time for schedule: ${s.label || s.type}`);
                      return;
                  }
              }
          }



          // Monetization Check: Free Limit = 2 Schedules (REMOVED per user request)
          /* 
          const enabledSchedules = schedules.filter(s => s.isEnabled);
          if (!isPremium && enabledSchedules.length > 2) {
              loading = false;
              showPremiumModal = true; 
              return;
          }
          */
          const enabledSchedules = schedules.filter(s => s.isEnabled);

          const schedulesToInsert = enabledSchedules.map(s => {
              let encodedTimes: string[] = [];

              if (s.frequency === 'daily') {
                  encodedTimes = s.times.map(t => t.label ? `${t.value}|${t.label}` : t.value);
              } else if (s.frequency === 'weekly') {
                  s.selectedDays.forEach(day => {
                       s.times.forEach(time => {
                           const timeStr = time.label ? `${time.value}|${time.label}` : time.value;
                           encodedTimes.push(`W:${day}:${timeStr}`);
                       });
                  });
              } else if (s.frequency === 'monthly') {
                   // Monthly frequency defaults to 1 AM per requirements
                   encodedTimes.push(`M:${s.selectedDayOfMonth}:01:00`);
               } else if (s.frequency === 'custom') {
                  s.customDates.forEach(date => {
                       s.times.forEach(time => {
                           const timeStr = time.label ? `${time.value}|${time.label}` : time.value;
                           encodedTimes.push(`C:${date}:${timeStr}`);
                       });
                  });
              }
              
              console.log(`Preparing schedule ${s.type} (${s.frequency}):`, encodedTimes);

              return {
                  pet_id: pet.id,
                  task_type: s.type,
                  label: s.label,
                  target_times: encodedTimes,
                  interval_hours: null, 
                  is_enabled: true,
                  schedule_mode: String(s.frequency).toLowerCase() 
              };
          });

          if (schedulesToInsert.length > 0) {
              console.log('Inserting schedules:', schedulesToInsert);
              const { data: insertedSchedules, error: schedError } = await supabase
                .from('schedules')
                .insert(schedulesToInsert)
                .select();

              
              if (schedError) {
                  console.error('Error inserting schedules:', schedError);
                  // We created the pet, but schedules failed. Ideally we'd rollback.
                  // For now just alert.
              }

              // 3. Generate Daily Tasks for Today immediately
              // This is critical so they appear on the dashboard instantly
              if (insertedSchedules && insertedSchedules.length > 0) {
                 // Import helper at top, but for now assuming it's available or I need to add import
                 // Generating for "today"
                 const newTasks = generateTasksForDate(insertedSchedules, new Date(), householdId);
                 
                 if (newTasks.length > 0) {
                     const { error: taskError } = await supabase
                        .from('daily_tasks')
                        .insert(newTasks);
                     
                     if (taskError) console.error("Error generating initial tasks:", taskError);
                 }
              }
          }
          
          goto('/');
      } catch (error: any) {
          console.error('Error creating pet:', error);
          alert(`Failed to add pet: ${error.message}`);
      } finally {
          loading = false;
      }
  }
  import PetIcon from '$lib/components/PetIcon.svelte';

  let fileInput: HTMLInputElement;
  let isUploading = false;

  async function handleFileUpload(e: Event) {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;
      
      if (!householdId && currentUser) {
          // Edge case: if creating a new household, we might not have ID yet.
          // But user should be auth'd. We can use user ID for folder structure.
      }

      isUploading = true;
      try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}.${fileExt}`;
          const filePath = `${currentUser.id}/${fileName}`;
          
          const { error: uploadError } = await supabase.storage
              .from('pet-avatars')
              .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
              .from('pet-avatars')
              .getPublicUrl(filePath);

          icon = publicUrl;
          showIconModal = false;

      } catch (error: any) {
          console.error('Upload failed:', error);
          alert('Failed to upload image: ' + error.message);
      } finally {
          isUploading = false;
      }
  }
</script>

<svelte:head>
  <title>New Pet - WhoFed</title>
</svelte:head>

<div class="min-h-screen bg-[#FDFDFD] pb-32 font-sans text-typography-primary">
    <!-- Top Nav -->
    <header class="bg-[#FDFDFD] px-6 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between">
        <div class="flex items-center">
            <button on:click={() => goto('/')} class="mr-4 p-2 -ml-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
                </svg>
            </button>
            <h1 class="text-xl font-bold text-typography-primary">New Pet</h1>
        </div>
        <button class="p-2 text-typography-secondary hover:text-brand-sage transition-colors">
             <span class="text-2xl leading-none mb-3 block">...</span>
        </button>
    </header>

    <main class="p-6 max-w-lg mx-auto space-y-8">
        
        <!-- Avatar Section -->
        <section class="flex flex-col items-center justify-center mb-8 relative z-10">
            <div class="relative group">
                <button 
                    type="button"
                    on:click={() => showIconModal = true}
                    class="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg bg-gray-100 flex items-center justify-center relative transition-transform active:scale-95"
                >
                    <PetIcon icon={icon} size="lg" />
                    
                    <!-- Edit Overlay -->
                    <div class="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    </div>
                </button>
                
                <!-- Quick Edit Button -->
                <button 
                    type="button"
                    on:click={() => showIconModal = true}
                    class="absolute bottom-1 right-1 w-8 h-8 bg-brand-sage rounded-full flex items-center justify-center text-white shadow-md hover:bg-brand-sage/90 transition-colors"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                </button>
            </div>

            <button 
                type="button"
                on:click={() => showIconModal = true}
                class="mt-3 text-xs font-bold text-brand-sage uppercase tracking-wider hover:underline"
            >
                Change Icon
            </button>
            
            <div class="mt-4 w-full max-w-xs space-y-4">
                <!-- Name Input -->
                <input 
                    type="text" 
                    bind:value={name} 
                    data-tour="pet-name-input"
                    class="block w-full text-center text-2xl font-bold text-typography-primary bg-transparent border-none p-0 focus:ring-0 placeholder-gray-300 focus:placeholder-gray-200"
                    placeholder="Name your pet..."
                />

                <!-- Species Input & Chips -->
                <div class="relative">
                    <input 
                        type="text" 
                        bind:value={species}
                        class="block w-full text-center text-sm font-bold text-typography-secondary bg-transparent border-b border-gray-200 focus:border-brand-sage pb-2 focus:ring-0 placeholder-gray-300"
                        placeholder="Type or select species (e.g. Dog)"
                    />
                    
                    <!-- Chips -->
                    <div class="flex flex-wrap justify-center gap-2 mt-3">
                        {#each QUICK_SPECIES as qs}
                            <button 
                                type="button"
                                class="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 hover:border-brand-sage hover:text-brand-sage transition-colors shadow-sm"
                                on:click={() => {
                                    species = qs.label;
                                    // If user hasn't manually picked a premium icon (or if current icon is generic/free),
                                    // strictly speaking, we could auto-update the icon. 
                                    // But let's only do it if the icon is presently the default '🐶' or matches another default.
                                    // Simpler: Just set it. If they want a weird combo (Dog named 'Cat'), they can fix it.
                                    icon = qs.icon; 
                                }}
                            >
                                {qs.label}
                            </button>
                        {/each}
                    </div>
                </div>
            </div>
        </section>

        <!-- Icon Selection Modal -->
        {#if showIconModal}
            <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
                <!-- Backdrop -->
                <button type="button" class="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" on:click={() => showIconModal = false}></button>
                
                <!-- Modal -->
                <div class="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-xl relative z-10 animate-scale-in max-h-[80vh] overflow-y-auto">
                    <h3 class="text-center text-lg font-bold text-typography-primary mb-6">Choose Icon</h3>
                    
                    <!-- Unified Icon Grid (All Emojis Free) -->
                    <div class="grid grid-cols-5 gap-3 mb-8">
                        {#each [...FREE_ICONS, ...PREMIUM_ICONS] as libraryIcon}
                            <button 
                                type="button"
                                class="flex items-center justify-center p-2 rounded-xl transition-all aspect-square border-2
                                {icon === libraryIcon ? 'border-brand-sage bg-brand-sage/5 shadow-sm scale-110' : 'border-transparent hover:bg-gray-50'}"
                                on:click={() => { icon = libraryIcon; showIconModal = false; }}
                            >
                                <span class="text-3xl">{libraryIcon}</span>
                            </button>
                        {/each}
                    </div>

                    <!-- Custom Upload (Premium Only) -->
                    <div class="border-t border-gray-100 pt-6">
                        <button 
                            type="button"
                            class="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 font-bold hover:border-brand-sage hover:text-brand-sage transition-all flex items-center justify-center space-x-2"
                            on:click={() => {
                                if (isPremium) {
                                    fileInput.click();
                                } else {
                                    showPremiumModal = true;
                                }
                            }}
                        >
                            {#if isUploading}
                                <span class="animate-spin">⏳</span>
                                <span>Uploading...</span>
                            {:else}
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>Upload Custom Photo</span>
                            {/if}
                            {#if !isPremium}
                                <span class="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">PREMIUM</span>
                            {/if}
                        </button>
                        <input 
                            bind:this={fileInput}
                            type="file" 
                            accept="image/*" 
                            class="hidden"
                            on:change={handleFileUpload}
                        />
                    </div>
                </div>
            </div>
        {/if}

        <h3 class="text-lg font-bold text-typography-primary mb-4 mt-8" data-tour="pet-schedules">Care Schedules</h3>

        <!-- Schedules List -->
        <div class="space-y-6">
            {#each schedules as schedule (schedule.id)}
                <div class="bg-white rounded-[32px] p-6 shadow-card animate-fade-in transition-all duration-300 border border-transparent {schedule.isEnabled ? 'border-brand-sage/20' : ''}">
                     <!-- Header -->
                     <div class="flex items-start justify-between mb-6">
                        <div class="flex items-center space-x-4 flex-1">
                             <div class="w-12 h-12 rounded-2xl flex items-center justify-center {schedule.type === 'feeding' ? 'bg-orange-50 text-orange-500' : schedule.type === 'litter' ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-500'}">
                                 {#if schedule.type === 'feeding'}
                                    <!-- Bowl Icon -->
                                    <span class="text-2xl">🥣</span>
                                 {:else if schedule.type === 'litter'}
                                    <!-- Litter Icon -->
                                    <span class="text-2xl">📥</span>
                                 {:else}
                                    <!-- Pill Icon -->
                                    <span class="text-2xl">💊</span>
                                 {/if}
                             </div>
                             <div class="flex-1 relative group">
                                 <input 
                                    type="text" 
                                    bind:value={schedule.label}
                                    class="font-extrabold text-typography-primary text-base bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-brand-sage focus:ring-0 w-full placeholder-gray-400 transition-colors pb-1"
                                    placeholder={schedule.type === 'feeding' ? 'Food Name' : schedule.type === 'litter' ? 'Change Litter' : 'Medication Name'}
                                />
                                <div class="absolute right-0 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                </div>
                             </div>
                        </div>

                        <div class="flex items-center space-x-3 ml-2">
                             <button 
                                type="button"
                                class="w-14 h-8 rounded-full transition-all relative flex-shrink-0 {schedule.isEnabled ? 'bg-brand-sage' : 'bg-gray-200'}"
                                on:click={() => schedule.isEnabled = !schedule.isEnabled}
                            >
                                <div class="{schedule.isEnabled ? 'translate-x-[26px]' : 'translate-x-1'} absolute top-1 left-0 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-300 ease-spring"></div>
                            </button>
                         </div>
                     </div>

                     {#if schedule.isEnabled}
                        <div class="mt-4 animate-fade-in">
                            <!-- Switcher -->
                            <div class="flex bg-gray-50 rounded-xl p-1 mb-6">
                                {#each ['daily', 'weekly', 'monthly', 'custom'] as freq}
                                    <button type="button" 
                                        class="flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all {schedule.frequency === freq ? 'bg-brand-sage text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}" 
                                        on:click={() => schedule.frequency = freq as any}>{freq}</button>
                                {/each}
                            </div>

                            <!-- Frequency Specific Controls -->
                            {#if schedule.frequency === 'weekly'}
                                <div class="mb-6">
                                    <label class="block text-sm font-bold text-typography-secondary mb-2">Select Days</label>
                                    <div class="flex justify-between">
                                        {#each DAYS_OF_WEEK as day}
                                            <button 
                                                type="button"
                                                class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border {schedule.selectedDays.includes(day.val) ? 'bg-brand-sage text-white border-brand-sage' : 'bg-white text-gray-400 border-gray-200 hover:border-brand-sage/50'}"
                                                on:click={() => {
                                                    if (schedule.selectedDays.includes(day.val)) {
                                                        schedule.selectedDays = schedule.selectedDays.filter(d => d !== day.val);
                                                    } else {
                                                        schedule.selectedDays = [...schedule.selectedDays, day.val];
                                                    }
                                                }}
                                            >
                                                {day.label}
                                            </button>
                                        {/each}
                                    </div>
                                </div>
                            {:else if schedule.frequency === 'monthly'}
                                <div class="mb-6">
                                    <label class="block text-sm font-bold text-typography-secondary mb-2">Day of Month</label>
                                    <div class="flex items-center bg-neutral-surface rounded-2xl px-4 py-3 border border-transparent focus-within:border-brand-sage/50">
                                        <span class="text-sm font-bold text-typography-secondary mr-2">Every</span>
                                        <input 
                                            type="number" 
                                            min="1" 
                                            max="31"
                                            bind:value={schedule.selectedDayOfMonth}
                                            class="bg-transparent border-none text-typography-primary font-bold focus:ring-0 p-0 text-base w-12 text-center"
                                        />
                                        <span class="text-sm font-bold text-typography-secondary ml-1">of the month</span>
                                    </div>
                                </div>
                            {:else if schedule.frequency === 'custom'}
                                <div class="mb-6">
                                    <label class="block text-sm font-bold text-typography-secondary mb-2">Specific Dates</label>
                                    <div class="flex items-center space-x-2 mb-3">
                                        <input 
                                            type="date" 
                                            id="date-picker-{schedule.id}"
                                            class="flex-1 bg-neutral-surface rounded-xl px-4 py-2 border-none text-sm font-bold text-typography-primary focus:ring-2 focus:ring-brand-sage/20 cursor-pointer accent-brand-sage"
                                        />
                                        <button 
                                            type="button"
                                            class="bg-brand-sage text-white rounded-xl px-4 py-2 text-sm font-bold shadow-sm hover:bg-brand-sage/90"
                                            on:click={() => {
                                                const el = document.getElementById(`date-picker-${schedule.id}`) as HTMLInputElement;
                                                if (el && el.value && !schedule.customDates.includes(el.value)) {
                                                    schedule.customDates = [...schedule.customDates, el.value];
                                                    el.value = '';
                                                }
                                            }}
                                        >
                                            Add
                                        </button>
                                    </div>
                                    
                                    {#if schedule.customDates.length > 0}
                                        <div class="flex flex-wrap gap-2">
                                            {#each schedule.customDates as date}
                                                <div class="bg-brand-sage/10 text-brand-sage px-3 py-1 rounded-full text-xs font-bold flex items-center">
                                                    {new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                    <button 
                                                        type="button" 
                                                        class="ml-2 hover:text-red-500"
                                                        on:click={() => schedule.customDates = schedule.customDates.filter(d => d !== date)}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            {/each}
                                        </div>
                                    {:else}
                                        <p class="text-xs text-gray-400 italic">No dates selected</p>
                                    {/if}
                                </div>
                            {/if}

                            <!-- Time Rows -->
                            {#if schedule.frequency !== 'monthly'}
                            <div class="space-y-3 mb-6">
                                <label class="block text-sm font-bold text-typography-secondary mb-2">At these times</label>
                                {#each schedule.times as time, i}
                                    <div class="flex items-center space-x-3 bg-neutral-surface rounded-2xl px-4 py-3 group focus-within:ring-2 focus-within:ring-brand-sage/50 transition-all border border-transparent hover:border-brand-sage/20">
                                         <!-- Label Input (Left) -->
                                         <div class="flex-1">
                                             <input 
                                                type="text" 
                                                bind:value={schedule.times[i].label}
                                                class="font-bold text-typography-primary bg-transparent border-none p-0 focus:ring-0 w-full placeholder-gray-400 text-sm"
                                                placeholder={i === 0 ? 'Breakfast' : i === 1 ? 'Dinner' : 'Label'}
                                            />
                                         </div>

                                         <!-- Vertical Divider -->
                                         <div class="w-px h-6 bg-gray-200"></div>

                                         <!-- Time Input (Right) -->
                                         <div class="relative">
                                             <input 
                                                type="time" 
                                                bind:value={schedule.times[i].value}
                                                class="bg-white rounded-lg px-3 py-1.5 border border-gray-100 text-typography-primary font-bold focus:ring-2 focus:ring-brand-sage/20 p-0 text-base w-36 text-center shadow-sm cursor-pointer accent-brand-sage"
                                            />
                                         </div>
                                         
                                         <!-- Delete Button (Far Right) -->
                                         <button 
                                            type="button"
                                            on:click={() => removeTime(schedule.id, i)}
                                            class="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-white hover:text-red-500 hover:shadow-sm transition-all flex-shrink-0"
                                            aria-label="Remove Time"
                                        >
                                            <span class="text-sm font-bold">✕</span>
                                        </button>
                                    </div>
                                {/each}
                            </div>

                            <!-- Dashed Add Button -->
                            <button 
                                type="button"
                                on:click={() => addTime(schedule.id)}
                                class="w-full py-3 border-2 border-dashed border-brand-sage/40 rounded-2xl text-brand-sage text-xs font-bold uppercase flex items-center justify-center space-x-2 hover:bg-brand-sage/5 transition-colors"
                            >
                                <span class="text-lg leading-none">+</span>
                                <span>Add {schedule.type === 'feeding' ? 'Time' : schedule.type === 'litter' ? 'Check' : 'Dose'}</span>
                            </button>
                            {/if}
                        </div>
                     {/if}
                </div>
            {/each}
            
            <!-- Quick Add Buttons -->
             <div class="grid grid-cols-3 gap-3 opacity-50 hover:opacity-100 transition-opacity">
                 <button on:click={() => addSchedule('feeding')} class="py-3 text-sm font-bold text-typography-secondary border border-dashed border-gray-300 rounded-2xl hover:border-brand-sage hover:text-brand-sage">+ Food</button>
                 <button on:click={() => addSchedule('medication')} class="py-3 text-sm font-bold text-typography-secondary border border-dashed border-gray-300 rounded-2xl hover:border-brand-sage hover:text-brand-sage">+ Meds</button>
                 <button on:click={() => addSchedule('litter')} class="py-3 text-sm font-bold text-typography-secondary border border-dashed border-gray-300 rounded-2xl hover:border-brand-sage hover:text-brand-sage">+ Litter</button>
             </div>
        </div>
 
        <h3 class="text-lg font-bold text-typography-primary mb-4 mt-8">Preferences</h3>
        
        <!-- Preferences Card -->
        <section class="bg-white rounded-[32px] p-2 shadow-card">
            <div class="flex items-center p-4">
               <div class="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 mr-4">
                   <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                   </svg>
               </div>
               <div class="flex-1">
                    <div class="text-base font-bold text-typography-primary">Alerts & Reminders</div>
                    <div class="text-sm font-bold text-typography-secondary">Push notifications enabled</div>
               </div>
               <button 
                   type="button"
                   class="w-12 h-7 rounded-full transition-all relative {pushReminders ? 'bg-brand-sage' : 'bg-gray-200'}"
                   on:click={() => pushReminders = !pushReminders}
               >
                   <div class="{pushReminders ? 'translate-x-[22px]' : 'translate-x-1'} absolute top-1 left-0 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300"></div>
               </button>
            </div>
        </section>

        <!-- Save Button -->
        <div class="pt-6 relative z-10">
            <button 
                type="submit"
                on:click={handleSubmit}
                disabled={loading}
                class="w-full h-14 bg-brand-sage text-white font-bold text-base rounded-2xl shadow-lg hover:bg-brand-sage/90 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {#if loading}
                    <div class="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                {:else}
                    Save Changes
                {/if}
            </button>
            
            <div class="mt-6 flex justify-center">
                 <button class="text-red-500 text-xs font-bold uppercase tracking-widest hover:underline flex items-center">
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                     </svg>
                     Cancel Setup
                 </button>
            </div>
        </div>

    </main>
</div>

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
