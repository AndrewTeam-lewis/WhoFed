<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import type { Database } from '$lib/database.types';

  type Pet = Database['public']['Tables']['pets']['Row'];
  type ActivityLog = Database['public']['Tables']['activity_log']['Row'] & {
    profiles: { first_name: string | null } | null
  };
  type Schedule = Database['public']['Tables']['schedules']['Row'];
  
  let pets: Pet[] = [];
  let schedules: Schedule[] = [];
  let recentActivity: ActivityLog[] = [];
  let loading = true;
  let currentUser: any = null;

  // Derived state to track today's completion
  type TaskItem = {
      scheduleId: string;
      label: string;
      subLabel: string;
      type: 'feeding' | 'medication';
      isDone: boolean;
      time?: string;
      dueLabel?: string; // e.g. "Due in 2h"
      dueDiff?: number; // ms diff from now
      isOverdue?: boolean;
  };

  function getTasksForPet(petId: string): TaskItem[] {
      const petSchedules = schedules.filter(s => s.pet_id === petId && s.is_enabled);
      const tasks: TaskItem[] = [];
      const now = new Date();
      const todayDateString = now.toISOString().split('T')[0];
      const todayDayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon
      const todayDayOfMonth = now.getDate(); // 1-31

      petSchedules.forEach(schedule => {
          // Get logs for this schedule today
          const todayStr = now.toDateString();
          const logsToday = recentActivity.filter(log => 
              log.schedule_id === schedule.id && 
              new Date(log.performed_at).toDateString() === todayStr
          );
          const completionCount = logsToday.length;

          // Parse target_times
          if (schedule.target_times && schedule.target_times.length > 0) {
              const activeTimes: string[] = [];

              schedule.target_times.forEach(encodedTime => {
                  const parts = encodedTime.split(':');
                  
                  if (parts.length >= 3) {
                      // Encoded format
                      const prefix = parts[0];
                      
                      if (prefix === 'W') {
                          // Weekly: W:Day:HH:MM
                          const day = parseInt(parts[1]);
                          const time = `${parts[2]}:${parts[3]}`;
                          if (day === todayDayOfWeek) activeTimes.push(time);
                      } else if (prefix === 'M') {
                          // Monthly: M:Day:HH:MM
                          const day = parseInt(parts[1]);
                          const time = `${parts[2]}:${parts[3]}`;
                          if (day === todayDayOfMonth) activeTimes.push(time);
                      } else if (prefix === 'C') {
                          // Custom: C:YYYY-MM-DD:HH:MM
                          // Re-join date parts if needed or just slice
                          // C:2025-01-01:08:00 -> parts[1] is 2025-01-01 maybe? Split depends on separators.
                          // Date string has hyphens, split by colon safe.
                          const date = parts[1];
                          const time = `${parts[2]}:${parts[3]}`;
                          if (date === todayDateString) activeTimes.push(time);
                      }
                  } else {
                      // Daily: HH:MM
                      activeTimes.push(encodedTime);
                  }
              });

              // Create a task for each ACTIVE time slot
              activeTimes.sort().forEach((time, index) => {
                  // If logs >= index + 1, this slot is done
                  const isDone = completionCount > index;
                  
                  // Format time (HH:MM to 12h)
                  const [h, m] = time.split(':');
                  const taskDate = new Date();
                  taskDate.setHours(parseInt(h), parseInt(m), 0, 0);
                  
                  const dueDiff = taskDate.getTime() - now.getTime(); // + = future, - = past
                  const hoursDiff = Math.ceil(dueDiff / (1000 * 60 * 60)); 
                  const minsDiff = Math.ceil(dueDiff / (1000 * 60));

                  const timeFormatted = taskDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

                  let dueLabel = 'Due';
                  if (isDone) {
                      dueLabel = 'Done';
                  } else if (dueDiff > 0) {
                       if (hoursDiff <= 1) {
                           dueLabel = `Due in ${minsDiff}m`;
                       } else {
                           dueLabel = `Due in ${hoursDiff}h`;
                       }
                  } else {
                       // Overdue
                       const absHours = Math.abs(Math.floor(dueDiff / (1000 * 60 * 60)));
                       if (absHours === 0) dueLabel = `Due now`; 
                       else dueLabel = `${absHours}h overdue`;
                  }

                  tasks.push({
                      scheduleId: schedule.id,
                      label: schedule.label || (schedule.task_type === 'feeding' ? 'Feeding' : 'Medication'),
                      subLabel: timeFormatted,
                      type: schedule.task_type as any,
                      isDone: isDone,
                      time: time,
                      dueLabel: dueLabel,
                      dueDiff: dueDiff,
                      isOverdue: !isDone && dueDiff < 0
                  });
              });
          }
      });

      // Sort tasks by time
      return tasks.sort((a, b) => {
          if (!a.time) return 1;
          if (!b.time) return -1;
          return a.time.localeCompare(b.time);
      });
  }

  onMount(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      goto('/auth/login');
      return;
    }
    currentUser = session.user;

    await fetchDashboardData();
  });

  async function fetchDashboardData() {
    loading = true;
    try {
      // 1. Get user's household
      const { data: members, error: memberError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', currentUser.id)
        .eq('is_active', true)
        .limit(1);

      if (memberError) throw memberError;

      if (members && members.length > 0) {
        const householdId = members[0].household_id;

        // 2. Get pets
        const { data: petData, error: petError } = await supabase
          .from('pets')
          .select('*')
          .eq('household_id', householdId)
          .order('name');
        
        if (petError) throw petError;
        pets = petData || [];

        // 3. Get Schedules
        const { data: schedData, error: schedError } = await supabase
            .from('schedules')
            .select('*')
            .in('pet_id', pets.map(p => p.id));
        
        if (schedError) throw schedError;
        schedules = schedData || [];

        // 4. Get recent activity (last 24h for completion check, + history)
        const { data: logData, error: logError } = await supabase
          .from('activity_log')
          .select('*, profiles(first_name)')
          .in('pet_id', pets.map(p => p.id))
          .order('performed_at', { ascending: false })
          .limit(50);

        if (logError) throw logError;
        recentActivity = logData || [];
      }

    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      loading = false;
    }
  }

  async function handleLogAction(petId: string, task: TaskItem) {
    // If it's already done, maybe we shouldn't allow clicking? Or maybe undo?
    // User didn't ask for undo, so let's allow "complete" action.
    if (task.isDone) return; 

    try {
      const { error } = await supabase
        .from('activity_log')
        .insert({
          pet_id: petId,
          schedule_id: task.scheduleId,
          user_id: currentUser.id,
          action_type: task.type,
          performed_at: new Date().toISOString()
        });

      if (error) throw error;

      // Refresh activity logic locally or fetch
      await fetchDashboardData();
    } catch (error) {
      console.error('Error logging action:', error);
      alert('Failed to log action');
    }
  }

  function formatTime(isoString: string) {
    return new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function formatTimeAgo(isoString: string) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  }
  let activeDropdownId: string | null = null;
  let petToDelete: string | null = null; // ID of pet pending deletion

  function toggleDropdown(id: string, event: MouseEvent) {
    event.stopPropagation();
    if (activeDropdownId === id) {
      activeDropdownId = null;
    } else {
      activeDropdownId = id;
    }
  }

  function closeDropdown() {
    activeDropdownId = null;
  }

  function promptDelete(petId: string) {
      petToDelete = petId;
      activeDropdownId = null; // Close dropdown
  }

  async function confirmDelete() {
      if (!petToDelete) return;
      
      try {
          const { error } = await supabase
              .from('pets')
              .delete()
              .eq('id', petToDelete);
          
          if (error) throw error;
          
          pets = pets.filter(p => p.id !== petToDelete);
          petToDelete = null;
      } catch(e) {
          console.error("Error deleting pet:", e);
          alert("Failed to delete pet");
          petToDelete = null;
      }
  }

  function cancelDelete() {
      petToDelete = null;
  }
</script>

<svelte:window on:click={closeDropdown} />

<svelte:head>
  <title>Dashboard - WhoFed</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 pb-20 relative">
  <!-- Delete Confirmation Modal -->
  {#if petToDelete}
      <div 
          class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in"
          role="button"
          tabindex="0"
          on:click|self={cancelDelete}
          on:keydown={(e) => e.key === 'Escape' && cancelDelete()}
      >
          <div class="bg-white rounded-[32px] p-8 w-full max-w-sm shadow-2xl scale-100 transform transition-all">
              <div class="mb-6 text-center">
                  <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                  </div>
                  <h3 class="text-xl font-bold text-gray-900 mb-2">Delete this pet?</h3>
                  <p class="text-gray-500 text-sm">
                      Are you sure you want to remove <span class="font-bold text-gray-800">{pets.find(p => p.id === petToDelete)?.name}</span>? This action is permanent and cannot be undone.
                  </p>
              </div>

              <div class="flex space-x-3">
                  <button 
                      class="flex-1 py-4 text-gray-600 font-bold text-sm bg-gray-50 hover:bg-gray-100 rounded-2xl transition-colors"
                      on:click={cancelDelete}
                  >
                      Cancel
                  </button>
                  <button 
                      class="flex-1 py-4 text-white font-bold text-sm bg-red-500 hover:bg-red-600 rounded-2xl shadow-lg shadow-red-500/20 transition-colors"
                      on:click={confirmDelete}
                  >
                      Yes, Delete
                  </button>
              </div>
          </div>
      </div>
  {/if}

  <!-- Header -->
  <header class="bg-white px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">My Pets</h1>
      <p class="text-sm text-gray-500">Keep them happy & healthy</p>
    </div>
    <a href="/settings" class="p-2 text-gray-400 hover:text-gray-600" aria-label="Settings">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </a>
  </header>

  <main class="p-6 space-y-6">
    {#if loading}
      <div class="flex justify-center py-10">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    {:else if pets.length === 0}
      <div class="text-center py-10 bg-white rounded-2xl p-6 shadow-sm">
        <p class="text-gray-500 mb-4">You haven't added any pets yet.</p>
        <a href="/pets/add" class="bg-primary-500 text-white px-6 py-2 rounded-full font-medium hover:bg-primary-600 transition-colors inline-block">
          Add Your First Pet
        </a>
      </div>
    {:else}
      <!-- Pet Cards -->
      <div class="space-y-4">
        {#each pets as pet}
          <div class="bg-white rounded-[32px] p-5 shadow-sm relative visible overflow-visible">
             <!-- Top Row: Icon, Name, status -->
             <div class="flex items-start justify-between mb-4 relative">
               <div class="flex items-center space-x-4">
                 <div class="bg-primary-50 p-3 rounded-2xl">
                   <!-- Placeholder icon based on species -->
                   <span class="text-3xl">
                    {#if pet.species.toLowerCase() === 'cat'}🐱
                    {:else if pet.species.toLowerCase() === 'bird'}🐦
                    {:else if pet.species.toLowerCase() === 'iguana'}🦎
                    {:else}🐶{/if}
                   </span>
                 </div>
                 <div>
                   <h3 class="font-bold text-xl text-gray-900 leading-tight">{pet.name}</h3>
                   <span class="inline-block bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider mt-1">{pet.species}</span>
                 </div>
               </div>
               
               <!-- Settings Menu Button -->
               <div class="relative">
                 <button 
                    on:click={(e) => toggleDropdown(pet.id, e)}
                    class="text-gray-300 hover:text-gray-500 p-1"
                    aria-label="Pet options"
                 >
                   <span class="text-2xl leading-none">⋯</span>
                 </button>

                 <!-- Dropdown Menu -->
                 {#if activeDropdownId === pet.id}
                    <div 
                        class="absolute right-0 top-8 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-fade-in"
                        on:click|stopPropagation
                    >
                        <a 
                            href="/pets/{pet.id}/settings" 
                            class="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center"
                            on:click={() => activeDropdownId = null}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            Edit Profile
                        </a>
                        <button 
                            class="w-full text-left px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 flex items-center border-t border-gray-50"
                            on:click={() => promptDelete(pet.id)}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete Pet
                        </button>
                    </div>
                 {/if}
               </div>
             </div>

             <!-- Action Buttons (Dynamic) -->
             <div class="grid grid-cols-1 gap-3 mt-6">
                {#each getTasksForPet(pet.id) as task}
                   <button 
                    on:click={() => handleLogAction(pet.id, task)}
                    disabled={task.isDone}
                    class="w-full py-4 px-5 rounded-2xl font-bold flex items-center justify-between text-left transition-all transform active:scale-[0.98]
                    {task.isDone 
                        ? 'bg-brand-sage/10 text-brand-sage border-2 border-brand-sage/20 cursor-default opacity-80' 
                        : 'bg-brand-sage text-white shadow-lg shadow-brand-sage/20 hover:opacity-95'}"
                   >
                     <div class="flex items-center space-x-3">
                         <span class="text-xl">{task.type === 'feeding' ? '🥣' : '💊'}</span>
                         <div>
                             <div class="text-sm leading-tight">{task.label}</div>
                             <div class="text-[10px] uppercase tracking-wide opacity-80">{task.subLabel}</div>
                         </div>
                     </div>
                     
                     <!-- Checkbox or Time -->
                     {#if task.isDone}
                        <div class="bg-brand-sage p-1 rounded-full text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                            </svg>
                        </div>
                     {:else}
                        <div class="text-xs font-bold bg-white/20 px-2 py-1 rounded-lg whitespace-nowrap">
                            {task.dueLabel}
                        </div>
                     {/if}
                   </button>
                {:else}
                    <div class="text-center py-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100 text-gray-400 text-sm">
                        No schedules set
                    </div>
                {/each}
             </div>
          </div>
        {/each}
      </div>

      <!-- Recent Activity -->
      <div>
        <div class="flex justify-between items-center mb-4 mt-8">
          <h2 class="font-bold text-gray-900 text-lg flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Recent Activity
          </h2>
          <a href="/history" class="text-xs font-bold text-primary-500 hover:text-primary-600 uppercase tracking-wide">See All</a>
        </div>

        <div class="space-y-4">
          {#each recentActivity as log}
             <div class="flex items-start">
               <!-- Timeline dot -->
               <div class="flex flex-col items-center mr-3 mt-1.5">
                 <div class="w-3 h-3 rounded-full border-2 border-primary-500 bg-white"></div>
                 {#if log !== recentActivity[recentActivity.length - 1]}
                   <div class="w-0.5 h-full bg-gray-200 my-1"></div>
                 {/if}
               </div>
               
               <div>
                  <div class="flex items-baseline space-x-2">
                    <span class="font-semibold text-gray-900 text-sm">
                      {log.profiles?.first_name || 'Unknown'}
                    </span>
                    <span class="text-gray-500 text-sm">
                      {#if log.action_type === 'feeding'}fed
                      {:else}gave meds to{/if}
                    </span>
                    <span class="font-semibold text-gray-900 text-sm">
                      {pets.find(p => p.id === log.pet_id)?.name || 'Pet'}
                    </span>
                  </div>
                  <div class="text-xs text-primary-500 font-medium mt-0.5">
                    {formatTimeAgo(log.performed_at)}
                  </div>
               </div>
             </div>
          {/each}
          
          {#if recentActivity.length === 0}
            <p class="text-gray-400 text-sm italic pl-6">No recent activity recorded.</p>
          {/if}
        </div>
      </div>
    {/if}
  </main>

  <!-- Floating Add Button -->
  <a href="/pets/add" class="fixed bottom-6 right-6 bg-brand-sage text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity transform hover:scale-105 z-20 shadow-brand-sage/30" aria-label="Add Pet">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
    </svg>
  </a>
</div>
