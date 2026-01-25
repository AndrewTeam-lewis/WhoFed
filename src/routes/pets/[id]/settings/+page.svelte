<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { generateTasksForDate } from '$lib/taskUtils';

  let loading = true;
  let saving = false;
  let petId = $page.params.id;
  
  // Form State
  let name = '';
  let species = '';
  let householdId: string | null = null;
  let currentUser: any = null;

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
      type: 'feeding' | 'medication';
      label: string;
      isEnabled: boolean;
      frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
      
      // We store the "Base" config here.
      // For this refactor, we assume all times in a group share these properties.
      selectedDays: number[]; 
      selectedDayOfMonth: number;
      customDates: string[];
      
      times: ScheduleTime[]; 
  };

  let schedules: ScheduleItem[] = [];
  
  // Track all Schedule IDs we loaded initially, to know what to delete
  let originalScheduleIds: Set<string> = new Set();

  const DAYS_OF_WEEK = [
      { val: 1, label: 'M' }, { val: 2, label: 'T' }, { val: 3, label: 'W' },
      { val: 4, label: 'T' }, { val: 5, label: 'F' }, { val: 6, label: 'S' }, { val: 0, label: 'S' }
  ];

  onMount(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      goto('/auth/login');
      return;
    }
    currentUser = session.user;
    await loadData();
  });

  async function loadData() {
      loading = true;
      try {
          const { data: pet, error: petError } = await supabase
            .from('pets')
            .select('*')
            .eq('id', petId)
            .single();
          
          if (petError) throw petError;
          
          name = pet.name;
          species = pet.species;
          householdId = pet.household_id;

          const { data: dbSchedules, error: schedError } = await supabase
            .from('schedules')
            .select('*')
            .eq('pet_id', petId);
            
          if (schedError) throw schedError;

          if (dbSchedules) {
              groupSchedulesForUi(dbSchedules);
              dbSchedules.forEach(s => originalScheduleIds.add(s.id));
          }
      } catch (e) {
          console.error("Error loading settings:", e);
          alert("Failed to load pet settings.");
          goto('/');
      } finally {
          loading = false;
      }
  }

  function groupSchedulesForUi(dbSchedules: any[]) {
      const groups: Record<string, ScheduleItem> = {};

      dbSchedules.forEach(row => {
          const { frequency, selectedDays, selectedDayOfMonth, customDates, timeStr } = parseDbRow(row);
          
          // Create a composite key to group logical schedules together in the UI
          const key = `${row.task_type}-${row.label}-${frequency}`;
          
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
                  times: []
              };
          }
          
          // Add this row's time to the group
          (row.target_times || []).forEach((t: string) => {
               const timeOnly = extractTimeFromEncoding(t, frequency);
               groups[key].times.push({
                   value: timeOnly,
                   scheduleId: row.id // This maps THIS specific time to THIS db row
               });
          });
      });

      schedules = Object.values(groups);
  }

  function extractTimeFromEncoding(encoded: string, freq: string): string {
      const parts = encoded.split(':');
      if (freq === 'weekly' && parts[0] === 'W') return `${parts[2]}:${parts[3]}`;
      if (freq === 'monthly' && parts[0] === 'M') return `${parts[2]}:${parts[3]}`;
      if (freq === 'custom' && parts[0] === 'C') return `${parts[2]}:${parts[3]}`;
      return encoded; 
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

  function addSchedule(type: 'feeding' | 'medication') {
      schedules = [...schedules, {
          uiId: Math.random().toString(36),
          type,
          label: type === 'feeding' ? 'NEW FOOD' : 'NEW MEDICATION',
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
      schedule.times = [...schedule.times, { value: '12:00' }];
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

  function formatRowForDb(s: ScheduleItem, timeVal: string) {
      let encodedTimes: string[] = [];

       if (s.frequency === 'daily') {
           encodedTimes = [timeVal];
       } else if (s.frequency === 'weekly') {
           s.selectedDays.forEach(day => {
                encodedTimes.push(`W:${day}:${timeVal}`);
           });
       } else if (s.frequency === 'monthly') {
           encodedTimes = [`M:${s.selectedDayOfMonth}:${timeVal}`];
       } else if (s.frequency === 'custom') {
           s.customDates.forEach(date => {
                encodedTimes.push(`C:${date}:${timeVal}`);
           });
       }
       
       return {
           pet_id: petId,
           task_type: s.type,
           label: s.label,
           target_times: encodedTimes,
           is_enabled: s.isEnabled,
           schedule_mode: 'interval'
       };
  }

  async function handleSubmit() {
      if (!name) return alert('Name required');
      saving = true;

      try {
          await supabase.from('pets').update({ name, species }).eq('id', petId);

          // 1. Calculate active IDs from UI state
          const activeIds = new Set<string>();
          const upsertPromises: Promise<any>[] = [];

          schedules.forEach(group => {
              group.times.forEach(t => {
                  const payload = formatRowForDb(group, t.value);
                  
                  if (t.scheduleId) {
                      // Update existing
                      activeIds.add(t.scheduleId);
                      upsertPromises.push(
                          supabase.from('schedules').update(payload).eq('id', t.scheduleId)
                      );
                  } else {
                      // Insert new
                      upsertPromises.push(
                          supabase.from('schedules').insert(payload)
                      );
                  }
              });
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
          await Promise.all(upsertPromises);

          // 4. Force Task Sync for Today
          const { data: freshSchedules } = await supabase.from('schedules').select('*').eq('pet_id', petId);
          if (freshSchedules) {
              const newTasks = generateTasksForDate(freshSchedules, new Date(), householdId!);
              
              if (newTasks.length > 0) {
                  const activeSchedIds = freshSchedules.map(s => s.id);
                  const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
                  
                  // Delete pending tasks to allow clean regen of modified times
                  await supabase.from('daily_tasks')
                      .delete()
                      .in('schedule_id', activeSchedIds)
                      .eq('status', 'pending')
                      .gte('due_at', startOfDay.toISOString());
                      
                  // Check what's missing (avoid duplicates for completed tasks)
                   const { data: existing } = await supabase
                      .from('daily_tasks')
                      .select('schedule_id, due_at')
                      .in('schedule_id', activeSchedIds)
                      .gte('due_at', startOfDay.toISOString());
                      
                   const existingMap = new Set(existing?.map(t => `${t.schedule_id}-${t.due_at}`));
                   
                   const toInsert = newTasks.filter(t => !existingMap.has(`${t.schedule_id}-${t.due_at}`));
                   
                   if (toInsert.length > 0) {
                       await supabase.from('daily_tasks').insert(toInsert);
                   }
              }
          }

          goto('/');
      } catch (e: any) {
          console.error(e);
          alert('Error saving: ' + e.message);
      } finally {
          saving = false;
      }
  }
</script>

<svelte:head>
  <title>Edit {name} - WhoFed</title>
</svelte:head>

<div class="min-h-screen bg-neutral-bg pb-24 font-sans text-typography-primary">
    <!-- Top Nav -->
    <header class="bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <button on:click={() => goto('/')} class="p-3 bg-white rounded-full shadow-soft hover:scale-105 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-typography-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
            </svg>
        </button>
        <h1 class="text-base font-bold text-typography-primary">Edit Details</h1>
        <div class="w-10"></div>
    </header>

    <main class="p-6 max-w-lg mx-auto space-y-10">
        {#if loading}
            <div class="flex justify-center py-20">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-sage"></div>
            </div>
        {:else}
            <!-- Pet Name Section -->
            <section>
                <div class="relative group">
                    <input 
                        type="text" 
                        bind:value={name} 
                        class="text-4xl font-extrabold tracking-tight text-typography-primary bg-transparent border-none focus:ring-0 p-0 w-full placeholder-typography-secondary/50"
                        placeholder="Pet Name"
                    />
                    <button class="absolute right-0 top-2 text-typography-secondary hover:text-brand-sage transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    </button>
                </div>
                <p class="text-xs font-bold text-typography-secondary uppercase tracking-widest mt-3 ml-1">PET NAME</p>
            </section>

            <!-- Species Selector -->
            <section>
                <label class="block text-xs font-bold text-typography-secondary uppercase tracking-widest mb-5 ml-1">SELECT SPECIES</label>
                <div class="grid grid-cols-4 gap-4">
                    {#each ['dog', 'cat', 'iguana', 'bird'] as type}
                        <button 
                            type="button"
                            class="flex flex-col items-center justify-center p-4 rounded-[32px] border-2 transition-all aspect-square
                            {species === type ? 'border-brand-sage bg-white shadow-soft scale-105' : 'border-transparent bg-white shadow-soft text-typography-secondary hover:bg-neutral-surface'}"
                            on:click={() => species = type}
                        >
                            <span class="text-3xl mb-2 filter {species !== type ? 'grayscale opacity-50' : ''}">
                                {type === 'dog' ? '🐶' : type === 'cat' ? '🐱' : type === 'bird' ? '🐦' : '🦎'}
                            </span>
                            <span class="text-xs font-bold capitalize {species === type ? 'text-typography-primary' : 'text-typography-secondary'}">{type}</span>
                        </button>
                    {/each}
                </div>
            </section>

            <!-- Schedules Card -->
            <section class="bg-white rounded-[40px] p-8 shadow-soft">
                <div class="flex items-center space-x-3 mb-8">
                    <div class="text-typography-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h3 class="font-extrabold text-typography-primary text-xl tracking-tight">Schedules</h3>
                </div>

                <div class="space-y-10">
                    {#each schedules as schedule (schedule.uiId)}
                        <div class="animate-fade-in">
                            <!-- Header Row -->
                            <div class="flex items-center justify-between mb-2">
                                <div class="flex items-center space-x-4 w-full">
                                    <!-- Custom Toggle -->
                                    <button 
                                        type="button"
                                        class="w-14 h-8 rounded-full transition-all relative flex-shrink-0 {schedule.isEnabled ? 'bg-brand-sage' : 'bg-gray-200'}"
                                        on:click={() => schedule.isEnabled = !schedule.isEnabled}
                                    >
                                        <div class="{schedule.isEnabled ? 'translate-x-[26px]' : 'translate-x-1'} absolute top-1 left-0 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-300 ease-spring"></div>
                                    </button>
                                    
                                    <!-- Editable Label -->
                                    <div class="relative group flex-1">
                                        <input 
                                            type="text" 
                                            bind:value={schedule.label}
                                            class="font-bold text-typography-primary uppercase text-xs tracking-widest bg-transparent border-b-2 border-transparent focus:border-brand-sage focus:outline-none w-full transition-colors pb-1 placeholder-typography-secondary truncate"
                                            placeholder="NAME"
                                        />
                                        <span class="absolute right-0 top-0 text-typography-secondary opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-[10px]">✎</span>
                                    </div>

                                    <!-- Delete Button -->
                                    <button type="button" on:click={() => removeSchedule(schedule.uiId)} class="text-gray-300 hover:text-red-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <!-- Switcher -->
                            <div class="flex bg-neutral-surface rounded-2xl p-1 shadow-inner mb-6 overflow-x-auto no-scrollbar">
                                {#each ['daily', 'weekly', 'monthly', 'custom'] as freq}
                                    <button type="button" 
                                        class="flex-1 py-2 px-3 text-[10px] font-bold uppercase rounded-xl transition-all whitespace-nowrap {schedule.frequency === freq ? 'bg-white shadow-sm text-typography-primary' : 'text-typography-secondary hover:text-typography-primary'}" 
                                        on:click={() => schedule.frequency = freq as any}>{freq}</button>
                                {/each}
                            </div>

                            {#if schedule.isEnabled}
                                <div class="space-y-5 animate-fade-in-down">
                                    <!-- Configuration based on Frequency -->
                                    
                                    {#if schedule.frequency === 'weekly'}
                                        <div class="flex justify-between mb-2 px-1">
                                            {#each DAYS_OF_WEEK as day}
                                                <button 
                                                    type="button"
                                                    class="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold transition-all border-2
                                                    {schedule.selectedDays.includes(day.val) ? 'bg-brand-sage/10 border-brand-sage text-brand-sage' : 'bg-transparent border-transparent text-typography-secondary hover:bg-neutral-surface'}"
                                                    on:click={() => toggleDay(schedule, day.val)}
                                                >
                                                    {day.label}
                                                </button>
                                            {/each}
                                        </div>
                                    {:else if schedule.frequency === 'monthly'}
                                        <div class="bg-neutral-surface rounded-2xl px-5 py-3 flex items-center justify-between">
                                            <span class="text-xs font-bold text-typography-secondary uppercase tracking-wider">Day of Month</span>
                                            <div class="flex items-center space-x-2">
                                                <span class="text-xl font-black text-brand-sage">{schedule.selectedDayOfMonth}</span>
                                                <input 
                                                    type="range" 
                                                    min="1" 
                                                    max="31" 
                                                    bind:value={schedule.selectedDayOfMonth}
                                                    class="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-sage"
                                                />
                                            </div>
                                        </div>
                                    {:else if schedule.frequency === 'custom'}
                                        <div class="bg-neutral-surface rounded-[24px] p-4">
                                            <!-- Calendar Header -->
                                            <div class="flex items-center justify-between mb-4">
                                                <button on:click={() => toggleCalendarMonth(-1)} class="p-1 hover:bg-gray-100 rounded-lg">
                                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                                                    </svg>
                                                </button>
                                                <span class="font-bold text-sm text-typography-primary">{getMonthName(calendarMonth)} {calendarYear}</span>
                                                <button on:click={() => toggleCalendarMonth(1)} class="p-1 hover:bg-gray-100 rounded-lg">
                                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </button>
                                            </div>

                                            <!-- Calendar Grid -->
                                            <div class="grid grid-cols-7 gap-1 text-center mb-2">
                                                {#each ['S','M','T','W','T','F','S'] as d}
                                                    <span class="text-[10px] font-bold text-typography-secondary">{d}</span>
                                                {/each}
                                            </div>
                                            <div class="grid grid-cols-7 gap-1">
                                                <!-- Empty slots -->
                                                {#each Array(new Date(calendarYear, calendarMonth, 1).getDay()) as _}
                                                    <div></div>
                                                {/each}
                                                <!-- Days -->
                                                {#each Array(getDaysInMonth(calendarMonth, calendarYear)) as _, i}
                                                    <button 
                                                        type="button" 
                                                        class="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                                                        {isDateSelected(schedule, i+1) ? 'bg-brand-sage text-white' : 'hover:bg-gray-100 text-gray-700'}"
                                                        on:click={() => toggleCustomDate(schedule, i+1)}
                                                    >
                                                        {i + 1}
                                                    </button>
                                                {/each}
                                            </div>
                                            
                                            <!-- Selected Dates Summary -->
                                            {#if schedule.customDates.length > 0}
                                                <div class="mt-4 flex flex-wrap gap-2">
                                                    {#each schedule.customDates as date}
                                                        <span class="inline-flex items-center px-2 py-1 bg-brand-sage/10 rounded-lg text-[10px] font-bold text-brand-sage">
                                                            {date}
                                                        </span>
                                                    {/each}
                                                </div>
                                            {/if}
                                        </div>
                                    {/if}

                                    <!-- Time List (1 col on mobile, 2 on larger) -->
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {#each schedule.times as time, i}
                                            <div class="flex items-center justify-between bg-neutral-surface rounded-2xl px-4 py-3 group focus-within:ring-2 focus-within:ring-brand-sage/50 transition-all border border-transparent hover:border-brand-sage/20">
                                                <div class="flex items-center flex-1">
                                                    <span class="text-typography-secondary mr-3 text-lg">
                                                        ⏰
                                                    </span>
                                                    <input 
                                                        type="time" 
                                                        bind:value={schedule.times[i].value}
                                                        class="bg-transparent border-none text-typography-primary font-bold focus:ring-0 p-0 w-full text-base"
                                                    />
                                                </div>
                                                <button 
                                                    type="button"
                                                    on:click={() => removeTime(schedule, i)}
                                                    class="ml-2 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-white hover:text-red-500 hover:shadow-sm transition-all"
                                                    aria-label="Remove Time"
                                                >
                                                    <span class="text-sm font-bold">✕</span>
                                                </button>
                                            </div>
                                        {/each}
                                    </div>
                                    <button 
                                        type="button"
                                        on:click={() => addTime(schedule)}
                                        class="w-full py-3.5 border-2 border-dashed border-brand-sage/30 rounded-2xl text-brand-sage text-[10px] font-bold uppercase tracking-widest hover:bg-brand-sage/5 hover:border-brand-sage transition-all flex items-center justify-center space-x-2"
                                    >
                                        <span>+ Add time</span>
                                    </button>
                            
                                </div>
                            {/if}
                            
                            <!-- Separator Line if not last? Logic simplified -->
                            <div class="h-px bg-neutral-surface my-10 w-full"></div>
                        </div>
                    {/each}

                    <!-- Add Schedule Buttons -->
                    <div class="flex space-x-4">
                        <button 
                            type="button" 
                            class="flex-1 py-4 border-[1.5px] border-dashed border-brand-sage rounded-[24px] text-brand-sage text-xs font-bold uppercase tracking-wide hover:bg-neutral-surface transition-colors"
                            on:click={() => addSchedule('feeding')}
                        >
                            + Add Feeding
                        </button>
                        <button 
                            type="button" 
                            class="flex-1 py-4 border-[1.5px] border-dashed border-brand-sage/50 text-brand-sage/70 text-xs font-bold uppercase tracking-wide hover:border-brand-sage hover:text-brand-sage transition-colors rounded-[24px]"
                            on:click={() => addSchedule('medication')}
                        >
                            + Add Medication
                        </button>
                    </div>
                </div>
            </section>

            <button 
                type="submit"
                on:click={handleSubmit}
                disabled={saving}
                class="w-full h-16 bg-brand-sage text-white font-bold text-lg rounded-3xl shadow-lg shadow-brand-sage/20 hover:bg-brand-sage/90 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01] active:scale-[0.99]"
            >
                {#if saving}
                    <div class="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                {:else}
                    Save All Changes
                {/if}
            </button>
        {/if}
    </main>
</div>
