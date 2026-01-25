<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { generateTasksForDate } from '$lib/taskUtils';
  import type { Database } from '$lib/database.types';
  import { swipe } from '$lib/actions';

  type Pet = Database['public']['Tables']['pets']['Row'];
  type DailyTask = Database['public']['Tables']['daily_tasks']['Row'] & {
      schedule_id?: string // Optional just for type safety if needed, but row has it
  };
  type ActivityLog = Database['public']['Tables']['activity_log']['Row'] & {
    profiles: { first_name: string | null } | null;
    schedules: { label: string | null, task_type: string } | null;
  };
  
  let pets: Pet[] = [];
  let dailyTasks: DailyTask[] = [];
  let recentActivity: ActivityLog[] = [];
  let loading = true;
  let currentUser: any = null;

  // Helper to split tasks by pet
  function getTasksForPet(petId: string, currentTasks: DailyTask[]): DailyTask[] {
      return currentTasks
          .filter(t => t.pet_id === petId)
          .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
  }

  // Visual Helper
  function getTaskVisuals(task: DailyTask) {
      const now = new Date();
      const due = new Date(task.due_at);
      const isDone = task.status === 'completed';
      
      const dueDiff = due.getTime() - now.getTime();
      const hoursDiff = Math.ceil(dueDiff / (1000 * 60 * 60));
      const minsDiff = Math.ceil(dueDiff / (1000 * 60));

      const isUrgent = !isDone && (dueDiff <= 7200000); // 2 hours
      const isOverdue = !isDone && dueDiff < 0;

      const timeFormatted = due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      
      let dueLabel = 'Due';
      if (isDone) {
          dueLabel = 'Done';
      } else if (isOverdue) {
           const absHours = Math.abs(Math.floor(dueDiff / (1000 * 60 * 60)));
           if (absHours === 0) dueLabel = `Due now`; 
           else dueLabel = `${absHours}h overdue`;
      } else if (dueDiff > 0) {
           if (hoursDiff <= 1) {
               dueLabel = `Due in ${minsDiff}m`;
           } else {
               dueLabel = `Due in ${hoursDiff}h`;
           }
      }

      return { isUrgent, isOverdue, timeFormatted, dueLabel };
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
        const { data: petData } = await supabase
          .from('pets')
          .select('*')
          .eq('household_id', householdId)
          .order('name');
        
        pets = petData || [];

        // 3. LAZY GENERATION: Check if we have tasks for today
        const startOfDay = new Date();
        startOfDay.setHours(0,0,0,0);
        const startOfDayStr = startOfDay.toISOString();

        const { data: existingTasks } = await supabase
            .from('daily_tasks')
            .select('*')
            .eq('household_id', householdId)
            .gte('due_at', startOfDayStr); // Simple check for "today and future"

        if (!existingTasks || existingTasks.length === 0) {
            // GENERATE TASKS
            const { data: activeSchedules } = await supabase
                .from('schedules')
                .select('*')
                .eq('is_enabled', true)
                .in('pet_id', pets.map(p => p.id));
            
            if (activeSchedules && activeSchedules.length > 0) {
                const newTasks = generateTasksForDate(activeSchedules, new Date(), householdId);
                
                if (newTasks.length > 0) {
                    const { data: insertedTasks, error: insertError } = await supabase
                        .from('daily_tasks')
                        .insert(newTasks)
                        .select();
                    
                    if (insertError) console.error("Error generating tasks", insertError);
                    dailyTasks = insertedTasks || [];
                }
            }
        } else {
            dailyTasks = existingTasks;
        }

        // 4. Get recent activity (purely for history log now)
        const { data: logData } = await supabase
          .from('activity_log')
          .select('*, profiles(first_name), schedules(label, task_type)')
          .in('pet_id', pets.map(p => p.id))
          .order('performed_at', { ascending: false })
          .limit(50);
        
        recentActivity = logData || [];
      }

    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      loading = false;
    }
  }

  async function fetchLogs() {
      if (pets.length === 0) return;
      const { data: logData } = await supabase
        .from('activity_log')
        .select('*, profiles(first_name), schedules(label, task_type)')
        .in('pet_id', pets.map(p => p.id))
        .order('performed_at', { ascending: false })
        .limit(50);
      recentActivity = logData || [];
  }

  async function handleLogAction(task: DailyTask) {
    try {
      const nowFn = new Date();
      const nowISO = nowFn.toISOString();

      if (task.status === 'completed') {
           // UNDO -> LOG "UN-FED" / "UN-GAVE"
           const undoActionType = task.task_type === 'feeding' ? 'unfed' : 'unmedicated';

           await supabase
            .from('activity_log')
            .insert({
              pet_id: task.pet_id,
              schedule_id: task.schedule_id, 
              user_id: currentUser.id,
              action_type: undoActionType,
              performed_at: nowISO,
              task_id: task.id 
            });

           // Reset the task status
           const { error } = await supabase
            .from('daily_tasks')
            .update({ status: 'pending', completed_at: null, user_id: null })
            .eq('id', task.id);
           
           if (error) throw error;
           
           // Optimistic Update for Task Button
           dailyTasks = dailyTasks.map(t => 
             t.id === task.id ? { ...t, status: 'pending', completed_at: null } : t
           );

           // RE-FETCH LOGS
           await fetchLogs();
           
      } else {
           // COMPLETE
           // 1. Update task
           const { error } = await supabase
            .from('daily_tasks')
            .update({ 
                status: 'completed', 
                completed_at: nowISO,
                user_id: currentUser.id
            })
            .eq('id', task.id);

           if (error) throw error;

           // 2. Insert log with TASK ID
           await supabase
            .from('activity_log')
            .insert({
              pet_id: task.pet_id,
              schedule_id: task.schedule_id, 
              user_id: currentUser.id,
              action_type: task.task_type,
              performed_at: nowISO,
              task_id: task.id 
            });

            // Optimistic Update for Task List
           dailyTasks = dailyTasks.map(t => 
             t.id === task.id ? { ...t, status: 'completed', completed_at: nowISO } : t
           );

            // Fetch latest logs
            await fetchLogs();
      }
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task');
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
  let petToDelete: string | null = null; 
  let taskToDelete: DailyTask | null = null;

  function toggleDropdown(id: string, event: MouseEvent) {
    event.stopPropagation();
    activeDropdownId = activeDropdownId === id ? null : id;
  }

  function closeDropdown() {
    activeDropdownId = null;
  }

  function promptDelete(petId: string) {
      petToDelete = petId;
      activeDropdownId = null; 
  }

  async function confirmDelete() {
      if (!petToDelete) return;
      try {
          const { error } = await supabase.from('pets').delete().eq('id', petToDelete);
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

  // TASK DELETION LOGIC
  function promptDeleteTask(task: DailyTask) {
      taskToDelete = task;
  }

  async function confirmDeleteTask() {
      if (!taskToDelete) return;
      try {
          // 1. Unlink any logs (to avoid FK issues) - Safe assuming we have ON DELETE SET NULL or we manually unlink
          await supabase
            .from('activity_log')
            .update({ task_id: null })
            .eq('task_id', taskToDelete.id);

          // 2. Delete the Task
          const { error } = await supabase
            .from('daily_tasks')
            .delete()
            .eq('id', taskToDelete.id);
            
          if (error) throw error;

          // 3. UI Update
          dailyTasks = dailyTasks.filter(t => t.id !== taskToDelete!.id);
          taskToDelete = null;

      } catch (e) {
          console.error("Error deleting task:", e);
          alert("Failed to delete task");
          taskToDelete = null;
      }
  }

  function cancelDeleteTask() {
      taskToDelete = null;
  }
</script>

<svelte:window on:click={closeDropdown} />

<svelte:head>
  <title>Dashboard - WhoFed</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 pb-20 relative">
  <!-- Delete Confirmation Modal (PET) -->
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

  <!-- Delete Confirmation Modal (TASK) -->
  {#if taskToDelete}
      <div 
          class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in"
          role="button"
          tabindex="0"
          on:click|self={cancelDeleteTask}
          on:keydown={(e) => e.key === 'Escape' && cancelDeleteTask()}
      >
          <div class="bg-white rounded-[32px] p-8 w-full max-w-sm shadow-2xl scale-100 transform transition-all">
              <div class="mb-6 text-center">
                  <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                  </div>
                  <h3 class="text-xl font-bold text-gray-900 mb-2">Delete this task?</h3>
                  <p class="text-gray-500 text-sm">
                      Remove <span class="font-bold text-gray-800">{taskToDelete.label}</span> for today? This will remove it from your dashboard.
                  </p>
              </div>

              <div class="flex space-x-3">
                  <button 
                      class="flex-1 py-4 text-gray-600 font-bold text-sm bg-gray-50 hover:bg-gray-100 rounded-2xl transition-colors"
                      on:click={cancelDeleteTask}
                  >
                      Cancel
                  </button>
                  <button 
                      class="flex-1 py-4 text-white font-bold text-sm bg-red-500 hover:bg-red-600 rounded-2xl shadow-lg shadow-red-500/20 transition-colors"
                      on:click={confirmDeleteTask}
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
      <!-- Settings Icon -->
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
          {@const tasks = getTasksForPet(pet.id, dailyTasks)}
          <div class="bg-white rounded-[32px] p-5 shadow-sm relative visible overflow-visible">
             <!-- Top Row: Icon, Name, status -->
             <div class="flex items-start justify-between mb-4 relative">
               <div class="flex items-center space-x-4">
                 <div class="bg-primary-5 p-3 rounded-2xl">
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
                        role="menu"
                        tabindex="-1"
                        on:click|stopPropagation
                        on:keydown|stopPropagation
                    >
                        <a 
                            href="/pets/{pet.id}/settings" 
                            class="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center"
                            on:click={() => activeDropdownId = null}
                            role="menuitem"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            Edit Profile
                        </a>
                        <a 
                            href="/pets/{pet.id}/history" 
                            class="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center"
                            on:click={() => activeDropdownId = null}
                            role="menuitem"
                        >
                            <!-- History Icon -->
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            History
                        </a>
                        <button 
                            class="w-full text-left px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 flex items-center border-t border-gray-50"
                            on:click={() => promptDelete(pet.id)}
                            role="menuitem"
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

             <!-- Action Buttons (Powered by daily_tasks) -->
             <div class="mt-4 space-y-2">
                {#each tasks as task}
                    {@const visuals = getTaskVisuals(task)}
                    {@const isDone = task.status === 'completed'}
                    
                     <button 
                        use:swipe={{ threshold: 50 }}
                        on:swipe={() => promptDeleteTask(task)}
                        on:click={() => handleLogAction(task)}
                        disabled={false}
                        class="w-full relative overflow-hidden transition-all duration-300 transform font-bold text-left group flex items-center justify-between rounded-2xl
                        {isDone 
                            ? 'p-2 bg-transparent text-gray-300 border border-dashed border-gray-200 scale-[0.98]' 
                            : visuals.isUrgent
                                ? 'p-3.5 bg-brand-sage text-white shadow-lg shadow-brand-sage/20 ring-1 ring-brand-sage z-10'
                                : 'p-3.5 bg-brand-sage/10 text-brand-sage border border-brand-sage/30 hover:bg-brand-sage/20'}"
                    >
                        <div class="flex items-center space-x-3 overflow-hidden">
                            <!-- Icon (Hide if done for slimness) -->
                            {#if !isDone}
                                <span class="text-xl filter {visuals.isUrgent ? 'drop-shadow-sm' : 'grayscale opacity-60'}">
                                    {task.task_type === 'feeding' ? '🥣' : '💊'}
                                </span>
                            {/if}

                            <div class="flex-1 min-w-0">
                                <div class="flex items-center text-sm leading-tight truncate {isDone ? 'text-xs line-through decoration-gray-300' : ''}">
                                    <span>{task.label}</span>
                                    {#if isDone}
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 ml-2 text-brand-sage/50" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                                        </svg>
                                    {/if}
                                </div>
                                {#if !isDone}
                                    <div class="text-[10px] uppercase tracking-wide opacity-80">{visuals.timeFormatted}</div>
                                {/if}
                            </div>
                        </div>

                        <!-- Status Label -->
                        {#if !isDone}
                            {#if visuals.isUrgent}
                                <div class="text-[10px] font-black bg-white/20 px-2 py-1 rounded-lg text-white whitespace-nowrap animate-pulse ml-2">
                                    {visuals.dueLabel}
                                </div>
                            {:else}
                                <div class="text-[10px] font-medium px-2 py-1 rounded-lg text-brand-sage/80 ml-2">
                                    {visuals.dueLabel}
                                </div>
                            {/if}
                        {:else if task.completed_at}
                            <div class="text-[10px] font-bold text-gray-400 ml-2 whitespace-nowrap">
                                {formatTime(task.completed_at)}
                            </div>
                        {/if}

                    </button>
                {/each}

                {#if tasks.length === 0}
                    <div class="text-center py-3 bg-gray-50 rounded-xl border border-dashed border-gray-100 text-gray-400 text-xs w-full">
                        No schedules set
                    </div>
                {/if}
             </div>
          </div>
        {/each}
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

