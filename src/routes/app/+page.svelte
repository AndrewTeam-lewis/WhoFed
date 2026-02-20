<script lang="ts">
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import type { Database } from '$lib/database.types';
  import { swipe } from '$lib/actions';
  import SwipeableTask from '$lib/components/SwipeableTask.svelte';

  type Pet = Database['public']['Tables']['pets']['Row'];
  type DailyTask = Database['public']['Tables']['daily_tasks']['Row'] & {
      schedule_id?: string;
      schedules?: { schedule_mode: string } | { schedule_mode: string }[] | null;
  };
  type ActivityLog = Database['public']['Tables']['activity_log']['Row'] & {
    profiles: { first_name: string | null } | null;
    schedules: { label: string | null, task_type: string } | null;
  };
  
  let pets: Pet[] = [];
  let dailyTasks: DailyTask[] = [];
  let recentActivity: ActivityLog[] = [];
  let loading = true;

  let showPremiumModal = false;
  let showHouseholdMenu = false;

  // Create Household State
  let showCreateHouseholdModal = false;
  let newHouseholdName = '';

  import { onboarding } from '$lib/stores/onboarding';
  import { activeHousehold, availableHouseholds, switchHousehold } from '$lib/stores/appState';
  import { ensureDailyTasks } from '$lib/services/taskService';
  import { currentUser, userIsPremium } from '$lib/stores/user';
  import PetIcon from '$lib/components/PetIcon.svelte';

  // Guard against duplicate fetches when stores update
  let lastFetchedForHouseholdId: string | null = null;

  $: if ($currentUser && $activeHousehold?.id && $activeHousehold.id !== lastFetchedForHouseholdId) {
      lastFetchedForHouseholdId = $activeHousehold.id;
      fetchDashboardData();
  }
  import { t, formatTime, formatDate, formatDateTime } from '$lib/services/i18n';

  // Animation State
  let shakingTaskId: string | null = null;
  let pulsingTaskId: string | null = null;

  // Time of Day Logic
  let timeOfDay = 'Morning';
  const hour = new Date().getHours();
  if (hour < 12) timeOfDay = 'Morning';
  else if (hour < 18) timeOfDay = 'Afternoon';
  else timeOfDay = 'Evening';

  // Helper to split tasks by pet
  function getTasksForPet(petId: string, currentTasks: DailyTask[]): DailyTask[] {
      const petTasks = currentTasks.filter(t => t.pet_id === petId && t.status !== 'archived');
      
      const completed = petTasks.filter(t => t.status === 'completed');
      const open = petTasks.filter(t => t.status !== 'completed');

      // Sort completed by completion time (ascending)
      completed.sort((a, b) => {
          const timeA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
          const timeB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
          return timeA - timeB;
      });

      // Sort open by due time (ascending)
      open.sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());

      // Completed first, then open
      return [...completed, ...open];
  }
  
  // Constraint Helper
  function getTaskConstraints(task: DailyTask, allTasksForPet: DailyTask[]) {
      // Group by distinct Type + Label (e.g. "feeding-Dry Food")
      // Case insensitive label comparison to be safe
      const peers = allTasksForPet
        .filter(t => 
            t.task_type === task.task_type && 
            t.label.toLowerCase() === task.label.toLowerCase()
        )
        .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());

      const index = peers.findIndex(t => t.id === task.id);
      
      // If it's the first one, it's never locked
      if (index <= 0) return { isLocked: false, blockerId: null };
      
      // Check previous
      const prev = peers[index - 1];
      if (prev.status !== 'completed') {
          return { isLocked: true, blockerId: prev.id };
      }
      
      return { isLocked: false, blockerId: null };
  }

  async function createNewHousehold() {
      if (!newHouseholdName.trim() || !$currentUser) return;

      // Premium gate: free users can own max 1 household
      if (!$userIsPremium) {
          const ownedCount = $availableHouseholds.filter(h => h.role === 'owner').length;
          if (ownedCount >= 1) {
              showPremiumModal = true;
              showHouseholdMenu = false;
              return;
          }
      }

      try {
          // 1. Create Household
          const { data: household, error: hhError } = await supabase
              .from('households')
              .insert({
                  name: newHouseholdName.trim(),
                  owner_id: $currentUser!.id,
                  subscription_status: 'free'
              })
              .select()
              .single();
          
          if (hhError) throw hhError;

          // 2. Add Owner as Member
          const { error: memberError } = await supabase
              .from('household_members')
              .insert({
                  household_id: household.id,
                  user_id: $currentUser!.id,
                  // role: 'owner', // Removed: column doesn't exist, inferred from household.owner_id
                  can_log: true,
                  can_edit: true,
                  is_active: true
              });

          if (memberError) throw memberError;

          // 3. Switch to it (Persist before reload)
          switchHousehold({ 
              id: household.id, 
              name: household.name, 
              role: 'owner', 
              subscription_status: household.subscription_status 
          });

          showCreateHouseholdModal = false;
          newHouseholdName = '';
          showHouseholdMenu = false;
          
          // Reload page to refresh dashboard with new context
          window.location.reload(); 

      } catch (e: any) {
          console.error('Error creating household:', e);
          alert('Failed to create household: ' + e.message);
      }
  }
  
  // Visual Helper
  function getTaskVisuals(task: DailyTask, translations: any, fmtDate: (d: Date) => string, fmtTime: (d: Date) => string, fmtDateTime: (d: Date) => string) {
      const now = new Date();
      const due = new Date(task.due_at);
      const isDone = task.status === 'completed';
      
      // Robust check for schedule_mode (handle array or object return from Supabase)
      const schedule = Array.isArray(task.schedules) ? task.schedules[0] : (task.schedules as any);
      const isMonthly = schedule?.schedule_mode === 'monthly';

      const dueDiff = due.getTime() - now.getTime();
      const hoursDiff = Math.round(dueDiff / (1000 * 60 * 60)); 
      const minsDiff = Math.floor(dueDiff / (1000 * 60));

      // Monthly: Show date (Feb 29). Daily: Show time (8:00 AM).
      // If Daily AND Overdue from previous day: Show Date + Time (Feb 16, 8:00 AM)
      const startOfToday = new Date();
      startOfToday.setHours(0,0,0,0);
      
      const isPastDate = due < startOfToday;

      const timeFormatted = isMonthly 
          ? fmtDate(due)
          : (isPastDate && !isDone)
              ? fmtDateTime(due)
              : fmtTime(due);
      
      let dueLabel = 'Due';
      let isUrgent = false;
      let isOverdue = false;

      if (isMonthly) {
          // Special Monthly Logic
          const today = new Date();
          const dueDay = new Date(task.due_at);
          
          // Reset times to compare dates specifically
          today.setHours(0,0,0,0);
          dueDay.setHours(0,0,0,0);
          
          const dayDiff = Math.floor((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          // Overdue only if strictly yesterday or earlier
          isOverdue = !isDone && dayDiff < 0; 
          
           if (isDone) {
               dueLabel = translations.dashboard.status_done;
           } else if (isOverdue) {
               dueLabel = translations.dashboard.status_overdue;
           } else if (dayDiff === 0) {
               dueLabel = translations.dashboard.status_due_today;
               isUrgent = true; 
           } else if (dayDiff === 1) {
               dueLabel = translations.dashboard.status_due_tomorrow;
           } else {
               dueLabel = translations.dashboard.status_due_days.replace('{n}', Math.abs(dayDiff));
           }

       } else {
           // Standard Logic
           isUrgent = !isDone && (dueDiff <= 7200000); 
           isOverdue = !isDone && dueDiff < 0;

           if (isDone) {
               dueLabel = translations.dashboard.status_done;
           } else if (isOverdue) {
                dueLabel = translations.dashboard.status_overdue;
           } else if (dueDiff > 0) {
                if (minsDiff < 30) {
                    dueLabel = translations.dashboard.status_due_soon;
                } else if (hoursDiff < 1) {
                    dueLabel = translations.dashboard.status_due_1h;
                } else {
                    dueLabel = translations.dashboard.status_due_hours.replace('{n}', hoursDiff);
                }
           }
       }

      return { isUrgent, isOverdue, timeFormatted, dueLabel };
  }

  async function fetchDashboardData() {
    if (!$activeHousehold) return;
    loading = true;
    
    try {
      const householdId = $activeHousehold.id;
      
      // Ensure tasks exist for today (Non-blocking)
      const ensurePromise = ensureDailyTasks(householdId);

      // Calculate day range
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      // Parallel Fetch: Pets & Tasks (Independent)
      // This runs immediately, showing whatever is currently in DB (instant)
      const [petRes, taskRes, pastMedsRes] = await Promise.all([
          supabase
            .from('pets')
            .select('*')
            .eq('household_id', householdId)
            .order('name'),
            
          supabase
            .from('daily_tasks')
            .select('*, schedules(schedule_mode)')
            .eq('household_id', householdId)
            .gte('due_at', startOfDay.toISOString())
            .lte('due_at', endOfDay.toISOString()),

          supabase
            .from('daily_tasks')
            .select('*, schedules(schedule_mode)')
            .eq('household_id', householdId)
            .eq('task_type', 'medication')
            .neq('status', 'completed')
            .lt('due_at', startOfDay.toISOString())
      ]);

      // Post-load check: Did we generate new tasks?
      ensurePromise.then(async (didGenerate) => {
          if (didGenerate) {
              // Quietly refresh today's tasks
              const { data: newTasks } = await supabase
                  .from('daily_tasks')
                  .select('*, schedules(schedule_mode)')
                  .eq('household_id', householdId)
                  .gte('due_at', startOfDay.toISOString())
                  .lte('due_at', endOfDay.toISOString());
              
              if (newTasks) {
                  // Merge or replace logic would be ideal, but for now just replacing today's tasks portion
                  // We need to re-merge with pastMeds to keep the view consistent
                   const pastMeds = pastMedsRes.data || [];
                   dailyTasks = [...pastMeds, ...newTasks].sort((a,b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
              }
          }
      });

      // Handle Pets
      pets = petRes.data || [];

      // Onboarding Trigger
      if (pets.length === 0) {
          onboarding.checkWelcome();
      }

      // Handle Tasks
      if (taskRes.error) throw taskRes.error;
      const todaysTasks = (taskRes.data || []) as any;
      const pastMeds = (pastMedsRes.data || []) as any;
      
      // Combine and Sort
      dailyTasks = [...pastMeds, ...todaysTasks];

      // 4. Get recent activity in background (non-blocking so tasks show immediately)
      loading = false;
      if (pets.length > 0) {
        supabase
          .from('activity_log')
          .select('*, profiles(first_name), schedules(label, task_type)')
          .in('pet_id', pets.map(p => p.id))
          .order('performed_at', { ascending: false })
          .limit(50)
          .then(({ data: logData, error: logError }) => {
            if (!logError) recentActivity = logData || [];
          });
      } else {
        recentActivity = [];
      }

    } catch (error) {
        console.error('Error fetching dashboard:', error);
        loading = false;
    }
  }

  function handleAddPet() {
      // Only owners can add pets
      if ($activeHousehold?.role !== 'owner') return;
      // Free Limit = 2 Pets
      if (!$userIsPremium && pets.length >= 2) {
          showPremiumModal = true;
      } else {
          goto('/pets/add');
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

      // Filter out undone actions
      const undoneTaskIds = new Set<string>();
      const filteredLogs = [];

      for (const row of (logData || [])) {
          if (row.action_type.startsWith('un')) {
              if (row.task_id) {
                  undoneTaskIds.add(row.task_id);
              }
              continue; // Skip the un- action
          }
          if (row.task_id && undoneTaskIds.has(row.task_id)) {
              // This is the original action that was cancelled
              undoneTaskIds.delete(row.task_id);
              continue; // Skip original action
          }
          filteredLogs.push(row);
      }

      recentActivity = filteredLogs;
  }

  async function handleLogAction(task: DailyTask) {
    try {
      const nowFn = new Date();
      const nowISO = nowFn.toISOString();

      if (task.status === 'completed') {
           // UNDO -> LOG "UN-FED" / "UN-GAVE" / "UN-CARED"
           const undoActionType = task.task_type === 'feeding' ? 'unfed' :
                                  task.task_type === 'care' ? 'uncared' :
                                  'unmedicated';

           await supabase
            .from('activity_log')
            .insert({
              pet_id: task.pet_id,
              schedule_id: task.schedule_id,
              user_id: $currentUser!.id,
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
                user_id: $currentUser!.id
            })
            .eq('id', task.id);

           if (error) throw error;

           // 2. Insert log with TASK ID
           await supabase
            .from('activity_log')
            .insert({
              pet_id: task.pet_id,
              schedule_id: task.schedule_id, 
              user_id: $currentUser!.id,
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
  
  // One-Time Task State
  let petForOneTimeTask: string | null = null;
  let oneTimeForm = {
      label: '',
      time: '',
      type: 'feeding' as 'feeding' | 'medication' | 'care'
  };

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
          // 1. Unlink from activity log (optional, but good for cleanup if it was completed)
          await supabase
            .from('activity_log')
            .update({ task_id: null })
            .eq('task_id', taskToDelete.id);

          // 2. Soft Delete (Archive) the task
          const { error } = await supabase
            .from('daily_tasks')
            .update({ status: 'archived' })
            .eq('id', taskToDelete.id);
            
          if (error) throw error;

          // 3. Remove from UI
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
  
  // ONE TIME TASK LOGIC
  function openOneTimeTaskModal(petId: string) {
      petForOneTimeTask = petId;
      activeDropdownId = null;
      // Default to next hour? or current time?
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      oneTimeForm = {
          label: '',
          time: timeStr,
          type: 'feeding'
      };
  }
  
  function closeOneTimeTaskModal() {
      petForOneTimeTask = null;
  }
  
  async function saveOneTimeTask() {
      if (!petForOneTimeTask || !oneTimeForm.label || !oneTimeForm.time) return;
      
      try {
          const pet = pets.find(p => p.id === petForOneTimeTask);
          if (!pet) return;

          // construct timestamp for today + time
          const [hours, mins] = oneTimeForm.time.split(':').map(Number);
          const dueAt = new Date();
          dueAt.setHours(hours, mins, 0, 0);
          
          const payload: Database['public']['Tables']['daily_tasks']['Insert'] = {
              pet_id: pet.id,
              household_id: pet.household_id,
              label: oneTimeForm.label,
              task_type: oneTimeForm.type,
              status: 'pending',
              due_at: dueAt.toISOString(),
              schedule_id: null // Explicitly null
          };
          
          const { data, error } = await supabase
            .from('daily_tasks')
            .insert(payload)
            .select()
            .single();
            
          if (error) throw error;
          if (data) {
              dailyTasks = [...dailyTasks, data].sort((a,b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
          }
          
          closeOneTimeTaskModal();
          
      } catch (e: any) {
          console.error("Error creating task:", e);
          alert("Failed to create task: " + e.message);
      }
  }
</script>

<svelte:window on:click={closeDropdown} />

<svelte:head>
  <title>Dashboard - WhoFed</title>
</svelte:head>

{#if !$currentUser}
  <div class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-sage"></div>
  </div>
{:else}
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
  
  <!-- Add One-Time Task Modal -->
  {#if petForOneTimeTask}
      <div 
          class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in"
          role="button"
          tabindex="0"
          on:click|self={closeOneTimeTaskModal}
          on:keydown={(e) => e.key === 'Escape' && closeOneTimeTaskModal()}
      >
          <div class="bg-white rounded-[32px] p-8 w-full max-w-sm shadow-2xl scale-100 transform transition-all">
              <div class="mb-6">
                  <div class="flex flex-col mb-1">
                      <div class="flex items-center space-x-2">
                          <h3 class="text-xl font-bold text-gray-900">{$t.modals.one_time_title}</h3>
                          <button 
                              class="text-gray-400 hover:text-brand-sage transition-colors p-1"
                              on:click={() => onboarding.showTooltip('onetime-task')}
                              aria-label="What is a one-time task?"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                          </button>
                      </div>
                      <p class="text-gray-500 text-xs mt-1">{$t.modals.one_time_desc.replace('{pet}', pets.find(p => p.id === petForOneTimeTask)?.name || '')}</p>
                  </div>
              </div>

              <div class="space-y-4 mb-8">
                  <!-- Type Toggle -->
                  <div class="bg-gray-100 p-1 rounded-xl grid grid-cols-3">
                      <button
                          class="py-2 rounded-lg text-sm font-bold transition-all {oneTimeForm.type === 'feeding' ? 'bg-white text-brand-sage shadow-sm' : 'text-gray-400 hover:text-gray-600'}"
                          on:click={() => oneTimeForm.type = 'feeding'}
                      >
                          {$t.modals.feeding}
                      </button>
                      <button
                          class="py-2 rounded-lg text-sm font-bold transition-all {oneTimeForm.type === 'medication' ? 'bg-white text-brand-sage shadow-sm' : 'text-gray-400 hover:text-gray-600'}"
                          on:click={() => oneTimeForm.type = 'medication'}
                      >
                          {$t.modals.medication}
                      </button>
                      <button
                          class="py-2 rounded-lg text-sm font-bold transition-all {oneTimeForm.type === 'care' ? 'bg-white text-brand-sage shadow-sm' : 'text-gray-400 hover:text-gray-600'}"
                          on:click={() => oneTimeForm.type = 'care'}
                      >
                          Care
                      </button>
                  </div>
                  
                  <!-- Name Input -->
                  <div>
                      <label class="block text-xs font-bold text-gray-500 mb-1 ml-1" for="taskLabel">{$t.modals.task_name}</label>
                      <input 
                          id="taskLabel"
                          type="text" 
                          bind:value={oneTimeForm.label}
                          placeholder={$t.modals.task_placeholder}
                          class="w-full bg-gray-50 border-transparent focus:border-brand-sage focus:bg-white focus:ring-0 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-300 transition-all"
                      />
                  </div>
                  
                  <!-- Time Input -->
                  <div>
                      <label class="block text-xs font-bold text-gray-500 mb-1 ml-1" for="taskTime">Time</label>
                      <input 
                          id="taskTime"
                          type="time" 
                          bind:value={oneTimeForm.time}
                          class="w-full bg-gray-50 border-transparent focus:border-brand-sage focus:bg-white focus:ring-0 rounded-2xl px-4 py-3 font-bold text-gray-900 transition-all"
                      />
                  </div>
              </div>

              <div class="flex space-x-3">
                  <button 
                      class="flex-1 py-4 text-gray-600 font-bold text-sm bg-gray-50 hover:bg-gray-100 rounded-2xl transition-colors"
                      on:click={closeOneTimeTaskModal}
                  >
                      Cancel
                  </button>
                  <button 
                      class="flex-1 py-4 text-white font-bold text-sm bg-brand-sage hover:bg-brand-sage/90 rounded-2xl shadow-lg shadow-brand-sage/20 transition-colors"
                      on:click={saveOneTimeTask}
                  >
                      Add Task
                  </button>
              </div>
          </div>
      </div>
  {/if}

  <!-- Create Household Modal -->
  {#if showCreateHouseholdModal}
  <div class="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button type="button" class="absolute inset-0 bg-black/50 backdrop-blur-sm" on:click={() => showCreateHouseholdModal = false}></button>
      <div class="bg-white rounded-[28px] p-6 w-full max-w-sm shadow-2xl relative z-10 animate-scale-in">
          <div class="text-center mb-6">
              <div class="w-16 h-16 bg-brand-sage/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-brand-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
              </div>
              <h3 class="text-xl font-bold text-gray-900">{$t.modals.create_household}</h3>
          </div>
          
          <div class="mb-6">
              <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{$t.modals.household_name}</label>
              <input 
                  type="text" 
                  bind:value={newHouseholdName}
                  placeholder="e.g., Beach House, Mom's Place..."
                  class="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-sage focus:border-transparent"
              />
          </div>
          
          <div class="flex space-x-3">
              <button class="flex-1 py-3 bg-gray-100 rounded-xl font-semibold text-gray-600 hover:bg-gray-200" on:click={() => showCreateHouseholdModal = false}>{$t.common.cancel}</button>
              <button 
                  class="flex-1 py-3 bg-brand-sage text-white rounded-xl font-semibold hover:bg-brand-sage/90 disabled:opacity-50" 
                  on:click={createNewHousehold}
                  disabled={!newHouseholdName.trim()}
              >{$t.common.save}</button>
          </div>
      </div>
  </div>
  {/if}

  <!-- Header -->
  <header class="bg-gray-50 px-6 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] flex justify-between items-center relative z-30">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">{$t.nav.dashboard}</h1>
      
       <!-- Household Toggle Dropdown -->
       <div class="relative inline-block">
            <button 
               class="flex items-center space-x-1 text-brand-sage font-medium hover:text-brand-sage/80 transition-colors"
               on:click|stopPropagation={() => showHouseholdMenu = !showHouseholdMenu}
            >
                <span>{$activeHousehold?.name || $currentUser?.user_metadata?.first_name || 'My Household'}</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform {showHouseholdMenu ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            
            <!-- Dropdown Menu -->
           {#if showHouseholdMenu}
               <div 
                   class="absolute top-full left-0 mt-2 w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-scale-in origin-top-left"
               >
                   <div class="py-1">
                       {#each $availableHouseholds as hh}
                           <button
                               class="w-full text-left px-4 py-3 text-sm font-medium hover:bg-gray-50 flex items-center gap-2
                               {$activeHousehold?.id === hh.id ? 'text-brand-sage bg-brand-sage/5' : 'text-gray-700'}"
                               on:click={() => {
                                   switchHousehold(hh);
                                   showHouseholdMenu = false;
                               }}
                           >
                               <span class="truncate flex-1">{hh.name}</span>
                               <span class="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0
                                   {hh.role === 'owner' ? 'bg-brand-sage/10 text-brand-sage' : 'bg-gray-100 text-gray-500'}">
                                   {hh.role === 'owner' ? 'Owner' : 'Member'}
                               </span>
                           </button>
                       {/each}
                       
                       <!-- Join/Create Option -->
                       <div class="border-t border-gray-100 mt-1 pt-1">
                             <button 
                                class="block w-full text-left px-4 py-3 text-xs font-bold text-gray-500 hover:text-brand-sage hover:bg-gray-50 flex items-center"
                                on:click={() => { showCreateHouseholdModal = true; showHouseholdMenu = false; }}
                             >
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                {$t.dashboard.new_household}
                             </button>
                        </div>
                   </div>
               </div>
           {/if}
       </div>
    </div>
    <a href="/settings" class="p-2 text-gray-400 hover:text-gray-600" aria-label={$t.dashboard.settings_label}>
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
        {#if $activeHousehold?.role === 'owner'}
        <p class="text-gray-500 mb-4">{$t.dashboard.no_pets}</p>
        <button
           data-tour="add-pet-btn"
           class="bg-brand-sage text-white px-6 py-2 rounded-full font-medium hover:bg-brand-sage/90 transition-colors inline-block"
           on:click={() => goto('/pets/add')}
        >
          {$t.dashboard.add_first_pet}
        </button>
        {:else}
        <p class="text-gray-500 mb-4">No pets have been added to this household yet. Ask the household owner to add pets.</p>
        {/if}
        
        <div class="mt-4">
            <button 
                class="text-sm text-gray-400 hover:text-brand-sage font-medium underline"
                on:click={() => onboarding.showWelcome()}
            >
                {$t.dashboard.show_me_around}
            </button>
        </div>
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
                 <!-- Circular pet icon with border -->
                 <div class="w-16 h-16 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    <PetIcon icon={pet.icon} extraClasses="!w-full !h-full" />
                 </div>
                 <div>
                   <h3 class="font-bold text-xl text-gray-900 leading-tight">{pet.name}</h3>

                 </div>
               </div>
               
               <!-- Settings Menu Button -->
               <div class="relative">
                 <button 
                    on:click={(e) => toggleDropdown(pet.id, e)}
                    class="p-2 text-gray-600 hover:text-gray-800 transition-colors"
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
                        <button 
                            class="w-full text-left px-4 py-3 text-sm font-medium text-brand-sage hover:bg-gray-50 flex items-center"
                            on:click={() => openOneTimeTaskModal(pet.id)}
                            role="menuitem"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-3 text-brand-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                            </svg>
                            {$t.pet_settings.add_to_today}
                        </button>
                    
                        <a 
                            href="/pets/{pet.id}/settings" 
                            class="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center"
                            on:click={() => activeDropdownId = null}
                            role="menuitem"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            {$t.pet_settings.edit_pet}
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
                            {$t.pet_settings.history}
                        </a>
                        {#if $activeHousehold?.role === 'owner'}
                        <button
                            class="w-full text-left px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 flex items-center border-t border-gray-50"
                            on:click={() => promptDelete(pet.id)}
                            role="menuitem"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            {$t.pet_settings.remove_pet}
                        </button>
                        {/if}
                    </div>
                 {/if}
               </div>
             </div>

             <!-- Action Buttons (Powered by daily_tasks) -->
             <div class="mt-4 space-y-2">
                {#each tasks as task (task.id)}
                    {@const visuals = getTaskVisuals(task, $t, $formatDate, $formatTime, $formatDateTime)}
                    {@const isDone = task.status === 'completed'}
                    {@const { isLocked, blockerId } = getTaskConstraints(task, tasks)}
                    
                    <SwipeableTask 
                        task={task} 
                        visuals={visuals} 
                        isDone={isDone}
                        isLocked={isLocked}
                        isShaking={shakingTaskId === task.id}
                        isPulsing={pulsingTaskId === task.id}
                        on:click={() => {
                            if (isLocked) {
                                // Trigger animations
                                shakingTaskId = task.id;
                                if (blockerId) pulsingTaskId = blockerId;
                                
                                setTimeout(() => {
                                    shakingTaskId = null;
                                    pulsingTaskId = null;
                                }, 600);
                            } else {
                                handleLogAction(task);
                            }
                        }}
                        on:delete={() => promptDeleteTask(task)}
                    />
                {/each}

                {#if tasks.length === 0}
                    <div class="text-center py-3 bg-gray-50 rounded-xl border border-dashed border-gray-100 text-gray-400 text-xs w-full">
                        {$t.dashboard.no_schedules}
                    </div>
                {/if}
             </div>
          </div>
        {/each}
      </div>


    {/if}
  </main>
    
  <!-- Floating Add Button (owners only) -->
  {#if $activeHousehold?.role === 'owner'}
  <button
      on:click={handleAddPet}
      class="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-6 bg-brand-sage text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity transform hover:scale-105 z-20 shadow-brand-sage/30"
      aria-label="Add Pet"
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
    </svg>
  </button>
  {/if}
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
{/if}

