<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { generateTasksForDate } from '$lib/taskUtils';
  import { ensureDailyTasks } from '$lib/services/taskService';
  import { activeHousehold, availableHouseholds } from '$lib/stores/appState';
  import { currentUser } from '$lib/stores/user';
  import PetIcon from '$lib/components/PetIcon.svelte';
  import { t } from '$lib/services/i18n';
  import { get } from 'svelte/store';
  import PhotoSourceModal from '$lib/components/PhotoSourceModal.svelte';
  import PhotoCropModal from '$lib/components/PhotoCropModal.svelte';
  import { uploadPetAvatar } from '$lib/services/imageUploadService';
  import { userIsPremium } from '$lib/stores/user';

  let loading = true;
  let saving = false;
  let petId = $page.params.id;

  // Form State
  let name = '';
  let icon = '🐱';
  let householdId: string | null = null;
  let isOwner = false;
  let showDeleteModal = false;
  let showIconModal = false;
  let showPremiumModal = false;
  let showPhotoSourceModal = false;
  let showPhotoCropModal = false;
  let selectedImageDataUrl: string | null = null;
  let uploadingPhoto = false;

  // Calendar State
  const today = new Date();
  let calendarMonth = today.getMonth();
  let calendarYear = today.getFullYear();

  // Dynamic Schedules
  // UI Abstraction: Groups multiple "DB Schedules" together if they share Label/Type
  type ScheduleTime = {
      value: string; // "08:00" or encoded "W:1:08:00"
      scheduleId?: string; // ID of the DB row this specific time belongs to
  };

  type ScheduleItem = {
      uiId: string; // Temporary ID for UI handling
      type: 'feeding' | 'medication' | 'care';
      label: string;
      isEnabled: boolean;
      frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
      
      // We store the "Base" config here.
      // For this refactor, we assume all times in a group share these properties.
      selectedDays: number[]; 
      selectedDayOfMonth: number;
      customDates: string[];
      
      times: ScheduleTime[]; 
      dbIds: string[]; // Track which DB rows this group represents
  };

  let schedules: ScheduleItem[] = [];
  
  // Track all Schedule IDs we loaded initially, to know what to delete
  let originalScheduleIds: Set<string> = new Set();

  const DAYS_OF_WEEK = [
      { val: 1, label: 'M' }, { val: 2, label: 'T' }, { val: 3, label: 'W' },
      { val: 4, label: 'T' }, { val: 5, label: 'F' }, { val: 6, label: 'S' }, { val: 0, label: 'S' }
  ];

  // Curated Pet Icons (ordered by commonality)
  const PET_ICONS = [
      '🐱', // Cat
      '🐶', // Dog
      '🐠', // Fish
      '🦜', // Parrot
      '🐰', // Rabbit
      '🐹', // Hamster
      '🦎', // Lizard
      '🐍', // Snake
      '🐢', // Turtle
      '🐈', // Cat (alternate)
      '🐕', // Dog (alternate)
      '🐁', // Mouse
      '🦔', // Hedgehog
      '🐾'  // Generic pet
  ];

  // Load data as soon as user is available
  let dataLoaded = false;
  $: if ($currentUser && !dataLoaded) {
      dataLoaded = true;
      loadData();
  }

  async function loadData() {
      loading = true;
      try {
          // Use store for owner check (already loaded by layout — zero network call)
          isOwner = $activeHousehold?.role === 'owner';

          // Fetch pet and schedules in parallel (1 round trip instead of 2 sequential)
          const [petRes, schedRes] = await Promise.all([
              supabase.from('pets').select('*').eq('id', petId).single(),
              supabase.from('schedules').select('*').eq('pet_id', petId).order('id', { ascending: true })
          ]);

          if (petRes.error) throw petRes.error;
          if (schedRes.error) throw schedRes.error;

          const pet = petRes.data;
          name = pet.name;
          icon = pet.icon || '🐱';
          householdId = pet.household_id;

          const dbSchedules = schedRes.data;
          if (dbSchedules) {
              console.log('Fetched dbSchedules:', dbSchedules);
              groupSchedulesForUi(dbSchedules);
              dbSchedules.forEach(s => originalScheduleIds.add(s.id));
          }
      } catch (e) {
          console.error("Error loading settings:", e);
          alert(get(t).pet_settings.load_error);
          goto('/');
      } finally {
          loading = false;
      }
  }

  function groupSchedulesForUi(dbSchedules: any[]) {
      console.log('--- Grouping Schedules ---');
      console.log('Input Rows:', dbSchedules);
      const groups: Record<string, ScheduleItem> = {};

      dbSchedules.forEach(row => {
          const { frequency, selectedDays, selectedDayOfMonth, customDates, timeStr } = parseDbRow(row);
          
          // Create a composite key to group logical schedules together in the UI
          // We MUST include the configuration (Days/Dates) in the key, otherwise distinct schedules 
          // (e.g. Mon/Wed 8am vs Tue/Thu 9am) would merge and corrupt the data.
          const configKey = frequency === 'weekly' ? selectedDays.sort().join(',') : 
                            frequency === 'custom' ? customDates.sort().join(',') : 
                            frequency === 'monthly' ? selectedDayOfMonth : '';
                            
          const key = `${row.task_type}-${row.label}-${frequency}-${configKey}`;
          console.log(`Row ${row.id}: Key="${key}", Freq="${frequency}", Config="${configKey}"`);
          
          if (!groups[key]) {
              groups[key] = {
                  uiId: Math.random().toString(36),
                  type: row.task_type,
                  label: row.label || '',
                  isEnabled: row.is_enabled, 
                  frequency,
                  selectedDays,
                  selectedDayOfMonth,
                  customDates,
                  times: [],
                  dbIds: []
              };
          }
          
          groups[key].dbIds.push(row.id);
          
          // Add this row's time to the group
          const times = row.target_times || [];
          console.log(`Row ${row.id} times:`, times);

          times.forEach((t: string) => {
               const { time } = extractTimeAndLabel(t, frequency);
               groups[key].times.push({
                   value: time,
                   scheduleId: row.id // This maps THIS specific time to THIS db row
               });
          });
      });

      const result = Object.values(groups);
      // Sort by the first dbId in each group to maintain insertion order
      result.sort((a, b) => {
          const aId = a.dbIds[0] || '';
          const bId = b.dbIds[0] || '';
          return aId.localeCompare(bId);
      });
      console.log('Final Groups:', result);
      schedules = result;
  }

  function extractTimeAndLabel(encoded: string, freq: string): { time: string, label: string } {
      // Split out optional label first: "EncodedStr|Label"
      const [encodedPart, labelPart] = encoded.split('|');
      const parts = encodedPart.split(':');
      
      let time = encodedPart;
      if (freq === 'weekly' && parts[0] === 'W') time = `${parts[2]}:${parts[3]}`;
      else if (freq === 'monthly' && parts[0] === 'M') time = `${parts[2]}:${parts[3]}`;
      else if (freq === 'custom' && parts[0] === 'C') time = `${parts[2]}:${parts[3]}`;
      
      return { time, label: labelPart || '' };
  }

  function parseDbRow(row: any) {
      const times = row.target_times || [];
      const first = times[0] || '';
      
      let frequency: any = 'daily';
      let selectedDays: number[] = [];
      let selectedDayOfMonth = 1;
      let customDates: string[] = [];
      let timeStr = '08:00';

      if (first.startsWith('W:')) {
          frequency = 'weekly';
          const daySet = new Set<number>();
          times.forEach((t: string) => {
              if(t.startsWith('W:')) daySet.add(parseInt(t.split(':')[1]));
          });
          selectedDays = Array.from(daySet);
      } else if (first.startsWith('M:')) {
          frequency = 'monthly';
          selectedDayOfMonth = parseInt(first.split(':')[1]);
      } else if (first.startsWith('C:')) {
          frequency = 'custom';
          const dateSet = new Set<string>();
          times.forEach((t: string) => {
              if(t.startsWith('C:')) dateSet.add(t.split(':')[1]);
          });
          customDates = Array.from(dateSet);
      }

      return { frequency, selectedDays, selectedDayOfMonth, customDates, timeStr };
  }

  function addSchedule(type: 'feeding' | 'medication' | 'care') {
      schedules = [...schedules, {
          uiId: Math.random().toString(36),
          type,
          label: '',
          isEnabled: true,
          isEnabled: true,
          frequency: 'daily',
          selectedDays: [], 
          selectedDayOfMonth: 1, 
          customDates: [], 
          times: [{ value: '08:00' }] // New time
      }];
  }

  function removeSchedule(uiId: string) {
      if(!confirm('Delete this whole group?')) return;
      schedules = schedules.filter(s => s.uiId !== uiId);
  }

  function addTime(schedule: ScheduleItem) {
      schedule.times = [...schedule.times, { value: '12:00', scheduleId: undefined }];
      schedules = [...schedules];
  }

  function removeTime(schedule: ScheduleItem, index: number) {
      schedule.times = schedule.times.filter((_, i) => i !== index);
      schedules = [...schedules];
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
      if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; } 
      else if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
  }
  function toggleCustomDate(schedule: ScheduleItem, day: number) {
      const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (schedule.customDates.includes(dateStr)) schedule.customDates = schedule.customDates.filter(d => d !== dateStr);
      else schedule.customDates = [...schedule.customDates, dateStr].sort();
      schedules = [...schedules];
  }
  function isDateSelected(schedule: ScheduleItem, day: number) {
      const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return schedule.customDates.includes(dateStr);
  }

  function formatRowForDb(s: ScheduleItem, timesToSave: { value: string, label: string }[]) {
      let encodedTimes: string[] = [];

       if (s.frequency === 'daily') {
           encodedTimes = timesToSave.map(t => t.value);
       } else if (s.frequency === 'weekly') {
           s.selectedDays.forEach(day => {
                timesToSave.forEach(t => {
                     encodedTimes.push(`W:${day}:${t.value}`);
                });
           });
       } else if (s.frequency === 'monthly') {
           // Monthly frequency defaults to 1 AM
           encodedTimes.push(`M:${s.selectedDayOfMonth}:01:00`);
       } else if (s.frequency === 'custom') {
           s.customDates.forEach(date => {
                timesToSave.forEach(t => {
                     encodedTimes.push(`C:${date}:${t.value}`);
                });
           });
       }
       
       return {
           pet_id: petId,
           task_type: s.type,
           label: s.label,
           target_times: encodedTimes,
           is_enabled: s.isEnabled,
           schedule_mode: s.frequency 
       };
  }

  async function handleCroppedPhoto(event: CustomEvent) {
      const { blob } = event.detail;
      uploadingPhoto = true;

      try {
          const { publicUrl } = await uploadPetAvatar($currentUser.id, blob, petId);
          icon = publicUrl;
          showPhotoCropModal = false;
          showIconModal = false;
      } catch (error: any) {
          console.error('Upload failed:', error);
          alert(`Upload failed: ${error.message}`);
      } finally {
          uploadingPhoto = false;
      }
  }

  async function handleSubmit() {
      if (!name) return alert(get(t).pet_settings.name_required);

      // Validate care tasks have names
      for (const s of schedules) {
          if (s.isEnabled && s.type === 'care' && !s.label.trim()) {
              alert(get(t).pet_settings.care_task_name_required);
              return;
          }
      }

      saving = true;

      try {
          await supabase.from('pets').update({ name, icon, household_id: householdId }).eq('id', petId);

          // 1. Calculate active IDs from UI state
          const activeIds = new Set<string>();
          const upsertPromises: Promise<any>[] = [];

          schedules.forEach(group => {
              const existingIds = group.dbIds || []; 
              const primaryId = existingIds[0];
              
              // Add ALL existing IDs to activeIds to prevent deletion
              existingIds.forEach(id => activeIds.add(id));

              const payload = formatRowForDb(group, group.times);

              if (primaryId) {
                  // Update primary
                  upsertPromises.push(
                      supabase.from('schedules').update(payload).eq('id', primaryId).select()
                  );
              } else {
                  // Insert new
                  upsertPromises.push(
                      supabase.from('schedules').insert(payload).select()
                  );
              }
          });

          // 2. Delete missing IDs (The "Sync" Step)
          const idsToDelete = Array.from(originalScheduleIds).filter(id => !activeIds.has(id));
          
          if (idsToDelete.length > 0) {
              await supabase
                  .from('activity_log')
                  .update({ schedule_id: null }) 
                  .in('schedule_id', idsToDelete);
                  
              await supabase
                  .from('daily_tasks')
                  .delete()
                  .in('schedule_id', idsToDelete);

              await supabase.from('schedules').delete().in('id', idsToDelete);
          }

          // 3. Execute Upserts
          // 3. Execute Upserts and Capture Results
          const results = await Promise.all(upsertPromises);
          
          // Flatten results (each result is { data, error })
          // We need to handle potential errors here too, but simplified for now
          // Supabase v2 returns { data: T[] | null, error }
          const freshSchedules = results
              .map(r => r.data)
              .flat()
              .filter(Boolean); // Filter out nulls

          if (freshSchedules.length > 0) {
              const activeSchedIds = freshSchedules.map(s => s.id);
              const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);

              // 1. DELETE ALL PENDING tasks for these schedules (Clean Slate)
              const { error: delError, count: delCount } = await supabase
                  .from('daily_tasks')
                  .delete({ count: 'exact' }) // Request exact count
                  .in('schedule_id', activeSchedIds)
                  .eq('status', 'pending')
                  .gte('due_at', startOfDay.toISOString());
              
              if (delError) console.error('Delete Error:', delError);
              console.log(`Cleared ${delCount} pending tasks for updated schedules.`);

              // 2. Fetch COMPLETED tasks (So we don't double-book)
              const { data: completedTasks } = await supabase
                  .from('daily_tasks')
                  .select('schedule_id, due_at')
                  .in('schedule_id', activeSchedIds)
                  .eq('status', 'completed')
                  .gte('due_at', startOfDay.toISOString());
                  
              // Helper to generate consistent keys
              // Even though we wiped pending, we still need to match against completed
              // using the same strategy to be safe.
              const getKey = (scheduleId: string, dueAt: string) => {
                  return `${scheduleId}-${new Date(dueAt).toISOString()}`;
              };

              const completedMap = new Set();
              completedTasks?.forEach(t => {
                  completedMap.add(getKey(t.schedule_id, t.due_at));
              });

              // 3. Generate POTENTIAL tasks from fresh schedule
              const potentialTasks = generateTasksForDate(freshSchedules, new Date(), householdId!);
              
              // 4. Filter: Only keep tasks that are NOT in the "Completed" set
              const toInsert = potentialTasks.filter(t => {
                  const key = getKey(t.schedule_id, t.due_at);
                  return !completedMap.has(key);
              });

              // 5. Insert
              if (toInsert.length > 0) {
                  console.log('Inserting regenerated tasks:', toInsert);
                  await supabase.from('daily_tasks').insert(toInsert);
              }
          }

          goto('/');
      } catch (e: any) {
          console.error(e);
          alert(get(t).pet_settings.save_error + e.message);
      } finally {
          saving = false;
      }
  }
</script>

<svelte:head>
  <title>Edit {name} - WhoFed</title>
</svelte:head>

<div class="min-h-screen bg-[#FDFDFD] pb-32 font-sans text-typography-primary">
    <!-- Top Nav -->
    <header class="bg-[#FDFDFD] px-6 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center">
        <a href="/" class="mr-4 p-2 -ml-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
            </svg>
        </a>
        <h1 class="text-xl font-bold text-typography-primary">{$t.pet_settings.title}</h1>
    </header>

    <main class="p-6 max-w-lg mx-auto space-y-8">
        {#if loading}
            <div class="flex justify-center py-20">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-sage"></div>
            </div>
        {:else}
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

                <!-- Explicit Change Label -->
                <button
                    type="button"
                    on:click={() => showIconModal = true}
                    class="mt-3 text-xs font-bold text-brand-sage uppercase tracking-wider hover:underline"
                >
                    {$t.pet_settings.change_icon}
                </button>

                <div class="mt-4 w-full max-w-xs text-center">
                    <input
                        type="text"
                        bind:value={name}
                        class="block w-full text-center text-2xl font-bold text-typography-primary bg-transparent border-none p-0 focus:ring-0 placeholder-gray-300 focus:placeholder-gray-200"
                        placeholder={$t.pet_settings.name_placeholder}
                    />
                </div>
            </section>

            <!-- Household Section (owners only) -->
            {#if isOwner && $availableHouseholds.length > 1}
            <section class="bg-white rounded-[24px] p-5 shadow-card">
                <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                    {$t.pet_settings.household}
                </label>
                <select
                    bind:value={householdId}
                    class="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 text-typography-primary font-medium focus:outline-none focus:ring-2 focus:ring-brand-sage focus:border-transparent"
                >
                    {#each $availableHouseholds as hh}
                        <option value={hh.id}>{hh.name}</option>
                    {/each}
                </select>
                <p class="text-xs text-gray-400 mt-2">{$t.pet_settings.move_household}</p>
            </section>
            {/if}

            <!-- Icon Selection Modal -->
            {#if showIconModal}
                <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <!-- Backdrop -->
                    <button type="button" class="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" on:click={() => showIconModal = false}></button>

                    <!-- Modal -->
                    <div class="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-xl relative z-10 animate-scale-in max-h-[80vh] overflow-y-auto">
                        <h3 class="text-center text-lg font-bold text-typography-primary mb-6">{$t.pet_settings.choose_icon}</h3>

                        <div class="grid grid-cols-5 gap-3">
                            {#each PET_ICONS as petIcon}
                                <button
                                    type="button"
                                    class="flex items-center justify-center p-2 rounded-xl transition-all aspect-square border-2
                                    {icon === petIcon ? 'border-brand-sage bg-brand-sage/5 shadow-sm scale-110' : 'border-transparent hover:bg-gray-50'}"
                                    on:click={() => { icon = petIcon; showIconModal = false; }}
                                >
                                    <span class="text-3xl">{petIcon}</span>
                                </button>
                            {/each}
                        </div>

                        <!-- Custom Upload (Premium Only) -->
                        <div class="border-t border-gray-100 pt-4 mt-4">
                            <button
                                type="button"
                                class="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 font-bold hover:border-brand-sage hover:text-brand-sage transition-all flex items-center justify-center space-x-2"
                                on:click={() => {
                                    if ($userIsPremium) {
                                        showIconModal = false;
                                        showPhotoSourceModal = true;
                                    } else {
                                        showPremiumModal = true;
                                    }
                                }}
                            >
                                {#if uploadingPhoto}
                                    <span class="animate-spin">⏳</span>
                                    <span>Uploading...</span>
                                {:else}
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span>Upload Photo</span>
                                {/if}
                                {#if !$userIsPremium}
                                    <span class="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">PREMIUM</span>
                                {/if}
                            </button>

                            <!-- Remove Photo Button (only if using custom photo) -->
                            {#if icon && icon.startsWith('http')}
                                <button
                                    type="button"
                                    class="w-full mt-2 py-2 text-sm text-red-500 hover:text-red-600 font-medium transition-colors"
                                    on:click={() => { icon = '🐱'; showIconModal = false; }}
                                >
                                    Remove Photo
                                </button>
                            {/if}
                        </div>
                    </div>
                </div>
            {/if}

            <!-- Photo Source Modal -->
            <PhotoSourceModal
                open={showPhotoSourceModal}
                on:select={(e) => {
                    selectedImageDataUrl = e.detail;
                    showPhotoSourceModal = false;
                    showPhotoCropModal = true;
                }}
                on:close={() => showPhotoSourceModal = false}
            />

            <!-- Photo Crop Modal -->
            {#if showPhotoCropModal && selectedImageDataUrl}
                <PhotoCropModal
                    imageDataUrl={selectedImageDataUrl}
                    open={showPhotoCropModal}
                    on:save={handleCroppedPhoto}
                    on:cancel={() => {
                        showPhotoCropModal = false;
                        selectedImageDataUrl = null;
                    }}
                />
            {/if}

            <!-- Premium Feature Modal -->
            {#if showPremiumModal}
                <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <button type="button" class="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" on:click={() => showPremiumModal = false}></button>

                    <div class="bg-white rounded-[32px] overflow-hidden w-full max-w-sm shadow-2xl relative z-10 animate-scale-in">
                        <div class="h-32 bg-brand-sage flex items-center justify-center relative overflow-hidden">
                            <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
                            <div class="w-16 h-16 bg-white rounded-full flex items-center justify-center text-3xl shadow-lg relative z-10">
                                💎
                            </div>
                        </div>

                        <div class="p-8 text-center">
                            <h3 class="text-2xl font-bold text-gray-900 mb-2">Premium Feature</h3>
                            <p class="text-gray-500 mb-6 leading-relaxed">
                                Custom pet photos are available for Premium users.
                                <br>
                                <span class="font-bold text-gray-800">Upgrade to unlock this and more.</span>
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

            <h3 class="text-lg font-bold text-typography-primary mb-4 mt-8">{$t.pet_settings.care_schedules}</h3>

            <!-- Schedules List -->
            <div class="space-y-6">
                {#each schedules as schedule (schedule.uiId)}
                    <div class="bg-white rounded-[32px] p-6 shadow-card animate-fade-in transition-all duration-300 border border-transparent {schedule.isEnabled ? 'border-brand-sage/20' : ''}">
                         <!-- Header -->
                         <div class="flex items-start justify-between mb-6">
                            <div class="flex items-center space-x-4 flex-1">
                                 <div class="w-12 h-12 rounded-2xl flex items-center justify-center {schedule.type === 'feeding' ? 'bg-orange-50 text-orange-500' : schedule.type === 'care' ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-500'}">
                                     {#if schedule.type === 'feeding'}
                                        <!-- Bowl Icon -->
                                        <span class="text-2xl">🥣</span>
                                     {:else if schedule.type === 'care'}
                                        <!-- Care Task Icon -->
                                        <span class="text-2xl">❤️</span>
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
                                        placeholder={schedule.type === 'feeding' ? $t.pet_settings.food_name_placeholder : schedule.type === 'care' ? $t.pet_settings.care_name_placeholder : $t.pet_settings.med_name_placeholder}
                                    />
                                    <div class="absolute right-0 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </div>
                                 </div>
                            </div>
                            
                            <div class="flex items-center space-x-3 ml-2">
                                <button type="button" on:click={() => removeSchedule(schedule.uiId)} class="text-gray-300 hover:text-red-500 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
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
                                            on:click={() => schedule.frequency = freq as any}>{$t.pet_settings[freq]}</button>
                                    {/each}
                                </div>

                                <!-- Frequency Specific Controls -->
                                {#if schedule.frequency === 'weekly'}
                                    <div class="mb-6">
                                        <label class="block text-sm font-bold text-typography-secondary mb-2">{$t.pet_settings.select_days}</label>
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
                                        <label class="block text-sm font-bold text-typography-secondary mb-2">{$t.pet_settings.day_of_month}</label>
                                        <div class="flex items-center bg-neutral-surface rounded-2xl px-4 py-3 border border-transparent focus-within:border-brand-sage/50">
                                            <span class="text-sm font-bold text-typography-secondary mr-2">{$t.pet_settings.every}</span>
                                            <input 
                                                type="number" 
                                                min="1" 
                                                max="31"
                                                bind:value={schedule.selectedDayOfMonth}
                                                class="bg-transparent border-none text-typography-primary font-bold focus:ring-0 p-0 text-base w-12 text-center"
                                            />
                                            <span class="text-sm font-bold text-typography-secondary ml-1">{$t.pet_settings.of_the_month}</span>
                                        </div>
                                    </div>
                                {:else if schedule.frequency === 'custom'}
                                    <div class="mb-6">
                                        <label class="block text-sm font-bold text-typography-secondary mb-2">{$t.pet_settings.specific_dates}</label>
                                        <div class="flex items-center space-x-2 mb-3">
                                            <input 
                                                type="date" 
                                                id="date-picker-{schedule.uiId}"
                                                class="flex-1 bg-neutral-surface rounded-xl px-4 py-2 border-none text-sm font-bold text-typography-primary focus:ring-2 focus:ring-brand-sage/20 cursor-pointer accent-brand-sage"
                                            />
                                            <button 
                                                type="button"
                                                class="bg-brand-sage text-white rounded-xl px-4 py-2 text-sm font-bold shadow-sm hover:bg-brand-sage/90"
                                                on:click={() => {
                                                    const el = document.getElementById(`date-picker-${schedule.uiId}`) as HTMLInputElement;
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
                                            <p class="text-xs text-gray-400 italic">{$t.pet_settings.no_dates}</p>
                                        {/if}
                                    </div>
                                {/if}

                            <!-- Time Rows -->
                            {#if schedule.frequency !== 'monthly'}
                            <div class="space-y-3 mb-6">
                                <label class="block text-sm font-bold text-typography-secondary mb-2">{$t.pet_settings.at_times}</label>
                                {#each schedule.times as time, i}
                                <div class="flex items-center space-x-3 bg-neutral-surface rounded-2xl px-4 py-3 group focus-within:ring-2 focus-within:ring-brand-sage/50 transition-all border border-transparent hover:border-brand-sage/20">

                                     <!-- Time Input (Left) -->
                                     <div class="relative flex-1">
                                         <input 
                                            type="time" 
                                            bind:value={schedule.times[i].value}
                                            class="w-full bg-white rounded-lg px-3 py-1.5 border border-gray-100 text-typography-primary font-bold focus:ring-2 focus:ring-brand-sage/20 p-0 text-base text-center shadow-sm cursor-pointer accent-brand-sage"
                                        />
                                     </div>
                                     
                                     <!-- Delete Button (Far Right) -->
                                     <button 
                                        type="button"
                                        on:click={() => removeTime(schedule, i)}
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
                                on:click={() => addTime(schedule)}
                                class="w-full py-3 border-2 border-dashed border-brand-sage/40 rounded-2xl text-brand-sage text-xs font-bold uppercase flex items-center justify-center space-x-2 hover:bg-brand-sage/5 transition-colors"
                            >
                                <span class="text-lg leading-none">+</span>
                                <span>{$t.pet_settings.add_time.replace('{type}', schedule.type)}</span>
                            </button>
                            {/if}
                            </div>
                         {/if}
                    </div>
                {/each}
                
                <div class="grid grid-cols-3 gap-3 opacity-50 hover:opacity-100 transition-opacity">
			<button on:click={() => addSchedule('feeding')} class="py-3 text-sm font-bold text-typography-secondary border border-dashed border-gray-300 rounded-2xl hover:border-brand-sage hover:text-brand-sage">{$t.pet_settings.add_food}</button>
			<button on:click={() => addSchedule('medication')} class="py-3 text-sm font-bold text-typography-secondary border border-dashed border-gray-300 rounded-2xl hover:border-brand-sage hover:text-brand-sage">{$t.pet_settings.add_meds}</button>
			<button on:click={() => addSchedule('care')} class="py-3 text-sm font-bold text-typography-secondary border border-dashed border-gray-300 rounded-2xl hover:border-brand-sage hover:text-brand-sage">{$t.pet_settings.add_care}</button>
                </div>
            </div>

            <!-- Delete Button (Edit Only) -->
            <div class="mt-8 flex justify-center">
                 <button class="flex items-center text-red-500 font-bold text-sm hover:underline p-2">
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                     </svg>
                     {$t.pet_settings.remove_profile}
                 </button>
            </div>

            <!-- Save Button -->
            <div class="pt-6 relative z-10">
                <button 
                    type="submit"
                    on:click={handleSubmit}
                class="w-full h-14 bg-brand-sage text-white font-bold text-base rounded-2xl shadow-lg hover:bg-brand-sage/90 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
                    {#if saving}
                        <div class="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                    {:else}
                        {$t.pet_settings.save_changes}
                    {/if}
                </button>
            </div>
        {/if}
    </main>
</div>
