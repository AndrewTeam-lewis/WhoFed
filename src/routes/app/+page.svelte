<script lang="ts">
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import type { Database } from '$lib/database.types';
  import { swipe } from '$lib/actions';
  import SwipeableTask from '$lib/components/SwipeableTask.svelte';
  import PremiumFeatureModal from '$lib/components/PremiumFeatureModal.svelte';

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

  // Pending invites state
  let pendingInvites: any[] = [];
  let showInviteBanner = true;

  // Create Household State
  let showCreateHouseholdModal = false;
  let newHouseholdName = '';
  let newHouseholdTimezone = getUserTimezone();
  let creatingHousehold = false;
  let errorHousehold = '';
  import { getUserTimezone, getAllTimezones } from '$lib/utils/timezones';
  let timezones = getAllTimezones();

  // Initialize timezone after mount or eagerly
  if (typeof window !== 'undefined') {
      newHouseholdTimezone = getUserTimezone();
  }

  // Notification Prompt State
  import { onMount } from 'svelte';
  import { Capacitor } from '@capacitor/core';
  import { notificationService } from '$lib/services/notifications';
  import NotificationPrompt from '$lib/components/NotificationPrompt.svelte';

  let showNotificationPrompt = false;

  onMount(async () => {
    // Refresh when app comes to foreground
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Start silent polling for task updates from other household members
    startPolling();

    // Only show on native platforms (Android/iOS)
    if (Capacitor.isNativePlatform()) {
      // Native foreground listener - refresh when app becomes active
      import('@capacitor/app').then(({ App: CapacitorApp }) => {
         CapacitorApp.addListener('appStateChange', (state) => {
            if (state.isActive) fetchDashboardData();
         }).then(listener => appStateListener = listener);
      });

      // Check if we should show the notification permission prompt
      try {
        const hasSeenPrompt = localStorage.getItem('notificationPromptShown');
        console.log('[NotifPrompt] hasSeenPrompt:', hasSeenPrompt);
        if (!hasSeenPrompt) {
            const isEnabled = await notificationService.checkSubscriptionState();
            console.log('[NotifPrompt] isEnabled:', isEnabled);
            if (!isEnabled) {
               setTimeout(() => {
                 console.log('[NotifPrompt] Showing prompt now');
                 showNotificationPrompt = true;
               }, 1500);
            }
        }
      } catch (e) {
        console.error('[NotifPrompt] Error checking notification state:', e);
        // Still show the prompt if the check fails
        setTimeout(() => {
          showNotificationPrompt = true;
        }, 1500);
      }
    }

    return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if (appStateListener) appStateListener.remove();
        stopPolling();
    };
  });

  function handleCloseNotificationPrompt() {
    showNotificationPrompt = false;
    localStorage.setItem('notificationPromptShown', 'true');
  }

  import { toZonedTime, fromZonedTime } from 'date-fns-tz';

  let appStateListener: any = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  const POLL_INTERVAL_MS = 30000; // 30 seconds

  function startPolling() {
    stopPolling();
    pollInterval = setInterval(silentRefreshTasks, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      // Refresh data when user returns to the app
      fetchDashboardData();
      startPolling();
    } else {
      stopPolling();
    }
  }

  async function silentRefreshTasks() {
    if (!$activeHousehold || !$currentUser) return;
    try {
      const householdId = $activeHousehold.id;
      const tz = $activeHousehold.timezone || 'America/New_York';
      const nowZoned = toZonedTime(new Date(), tz);
      const startOfDay = new Date(nowZoned.getTime());
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(nowZoned.getTime());
      endOfDay.setHours(23, 59, 59, 999);
      const startOfDayUTC = fromZonedTime(startOfDay, tz);
      const endOfDayUTC = fromZonedTime(endOfDay, tz);

      const [todayTasksRes, oldMedsRes] = await Promise.all([
        supabase
          .from('daily_tasks')
          .select('*, schedules(schedule_mode)')
          .eq('household_id', householdId)
          .gte('due_at', startOfDayUTC.toISOString())
          .lte('due_at', endOfDayUTC.toISOString()),
        supabase
          .from('daily_tasks')
          .select('*, schedules(schedule_mode)')
          .eq('household_id', householdId)
          .eq('task_type', 'medication')
          .eq('status', 'pending')
          .lt('due_at', startOfDayUTC.toISOString())
      ]);

      if (!todayTasksRes.error) {
        const todayTasks = (todayTasksRes.data || []) as any;
        const oldMeds = (oldMedsRes.data || []) as any;
        dailyTasks = [...oldMeds, ...todayTasks];
      }
    } catch (e) {
      // Silent fail — don't disrupt the UI
    }
  }

  // Pull-to-refresh state
  let pullStartY = 0;
  let pullCurrentY = 0;
  let isPulling = false;
  let isRefreshing = false;
  const pullThreshold = 80; // pixels to trigger refresh

  function handleTouchStart(e: TouchEvent) {
    if (window.scrollY === 0) {
      pullStartY = e.touches[0].clientY;
      isPulling = true;
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isPulling || isRefreshing) return;

    pullCurrentY = e.touches[0].clientY - pullStartY;

    // Only allow pulling down
    if (pullCurrentY < 0) {
      pullCurrentY = 0;
    }

    // Prevent default scrolling when pulling
    if (pullCurrentY > 0 && window.scrollY === 0) {
      e.preventDefault();
    }
  }

  async function handleTouchEnd() {
    if (!isPulling || isRefreshing) return;

    if (pullCurrentY > pullThreshold) {
      isRefreshing = true;
      await fetchDashboardData();
      isRefreshing = false;
    }

    isPulling = false;
    pullCurrentY = 0;
  }

  import { onboarding } from '$lib/stores/onboarding';
  import { activeHousehold, availableHouseholds, switchHousehold, validateHouseholdMembership } from '$lib/stores/appState';
  import CustomTimezoneSelect from '$lib/components/CustomTimezoneSelect.svelte';
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

  function handleAddHouseholdClick() {
      // Premium gate: check before opening modal
      if (!$userIsPremium) {
          const ownedCount = $availableHouseholds.filter(h => h.role === 'owner').length;
          if (ownedCount >= 1) {
              showPremiumModal = true;
              showHouseholdMenu = false;
              return;
          }
      }

      // User can create household, open the modal
      showCreateHouseholdModal = true;
      showHouseholdMenu = false;
  }

  async function createNewHousehold() {
      if (!newHouseholdName.trim() || !$currentUser) return;

      try {
          // 1. Create Household
          const { data: household, error: hhError } = await supabase
              .from('households')
              .insert({
                  name: newHouseholdName.trim(),
                  timezone: newHouseholdTimezone,
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
          alert(`${$t.dashboard.error_create_household}: ${e.message}`);
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
      // If Daily AND from a PAST day (not today): Show date above time
      // CRITICAL: Compare in household timezone, not client timezone
      const tz = $activeHousehold?.timezone || 'America/New_York';
      const nowZoned = toZonedTime(new Date(), tz);
      const todayZoned = new Date(nowZoned.getTime());
      todayZoned.setHours(0,0,0,0);

      const dueZoned = toZonedTime(due, tz);
      const dueDateZoned = new Date(dueZoned.getTime());
      dueDateZoned.setHours(0,0,0,0);

      const isPastDate = dueDateZoned < todayZoned; // Compare dates only - true only for previous days
      const showDateBadge = isPastDate && !isDone;

      const timeFormatted = isMonthly ? fmtDate(due) : fmtTime(due);
      // Format full month name (e.g., "March 7") - use household timezone
      const dateFormatted = showDateBadge
          ? toZonedTime(due, tz).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
          : null;

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

      return { isUrgent, isOverdue, timeFormatted, dateFormatted, dueLabel };
  }

  async function fetchDashboardData() {
    if (!$activeHousehold || !$currentUser) return;
    loading = true;

    try {
      const householdId = $activeHousehold.id;

      // Validate membership before fetching data
      const isMember = await validateHouseholdMembership(householdId, $currentUser.id);
      if (!isMember) {
        console.warn('[Dashboard] User is no longer a member, redirecting...');
        loading = false;
        // Validation function already updated the stores and switched households
        // If no households left, user will see the household setup modal
        return;
      }

      // Note: Server-side CRON handles task generation/cleanup every 5 minutes
      // Client fetches: (1) All tasks for today, (2) Old pending medications

      // Calculate today's date range in household timezone
      const tz = $activeHousehold.timezone || 'America/New_York';
      const nowZoned = toZonedTime(new Date(), tz);
      const startOfDay = new Date(nowZoned.getTime());
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(nowZoned.getTime());
      endOfDay.setHours(23, 59, 59, 999);
      const startOfDayUTC = fromZonedTime(startOfDay, tz);
      const endOfDayUTC = fromZonedTime(endOfDay, tz);

      // Parallel Fetch: Pets & Today's Tasks & Old Medications & Pending Invites
      const [petRes, todayTasksRes, oldMedsRes, invitesRes] = await Promise.all([
          supabase
            .from('pets')
            .select('*')
            .eq('household_id', householdId)
            .order('name'),

          // All tasks for today (pending + completed)
          supabase
            .from('daily_tasks')
            .select('*, schedules(schedule_mode)')
            .eq('household_id', householdId)
            .gte('due_at', startOfDayUTC.toISOString())
            .lte('due_at', endOfDayUTC.toISOString()),

          // Old pending medications (from before today)
          supabase
            .from('daily_tasks')
            .select('*, schedules(schedule_mode)')
            .eq('household_id', householdId)
            .eq('task_type', 'medication')
            .eq('status', 'pending')
            .lt('due_at', startOfDayUTC.toISOString()),

          // Pending household invitations for current user
          supabase
            .from('household_invitations')
            .select('id, household_id, created_at, households(name), profiles!household_invitations_invited_by_fkey(first_name)')
            .eq('invited_user_id', $currentUser!.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
      ]);

      // Handle Pets
      pets = petRes.data || [];

      // Handle Pending Invites
      pendingInvites = invitesRes.data || [];

      // Show welcome for new users (only if not seen before)
      onboarding.checkWelcome();

      // Handle Tasks - combine today's tasks with old medications
      if (todayTasksRes.error) throw todayTasksRes.error;
      const todayTasks = (todayTasksRes.data || []) as any;
      const oldMeds = (oldMedsRes.data || []) as any;
      dailyTasks = [...oldMeds, ...todayTasks];

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
    if (!$currentUser || !$activeHousehold) return;

    // Validate membership before allowing action
    const isMember = await validateHouseholdMembership($activeHousehold.id, $currentUser.id);
    if (!isMember) {
      console.warn('[Task Action] User is no longer a member, blocking action');
      // Validation function already updated stores and switched households
      fetchDashboardData(); // Refresh to show correct household
      return;
    }

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
      alert($t.dashboard.error_update_task);
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
          alert($t.dashboard.error_delete_pet);
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
          alert($t.dashboard.error_delete_task);
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
          alert(`${$t.dashboard.error_create_task}: ${e.message}`);
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
<div
  class="min-h-screen bg-gray-50 pb-20 relative"
  on:touchstart={handleTouchStart}
  on:touchmove={handleTouchMove}
  on:touchend={handleTouchEnd}
>
  <!-- Pull-to-refresh indicator -->
  {#if isPulling || isRefreshing}
    <div
      class="fixed top-0 left-0 right-0 flex items-center justify-center z-40 transition-all duration-200"
      style="height: {Math.min(pullCurrentY, pullThreshold)}px; opacity: {Math.min(pullCurrentY / pullThreshold, 1)}"
    >
      <div class="bg-white rounded-full p-2 shadow-lg">
        {#if isRefreshing}
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-sage"></div>
        {:else}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6 text-brand-sage transition-transform"
            style="transform: rotate({Math.min(pullCurrentY / pullThreshold * 180, 180)}deg)"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        {/if}
      </div>
    </div>
  {/if}
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
                  <h3 class="text-xl font-bold text-gray-900 mb-2">{$t.dashboard.delete_pet_title}</h3>
                  <p class="text-gray-500 text-sm">
                      {$t.dashboard.delete_pet_desc.replace('{name}', pets.find(p => p.id === petToDelete)?.name || '')}
                  </p>
              </div>

              <div class="flex space-x-3">
                  <button
                      class="flex-1 py-4 text-gray-600 font-bold text-sm bg-gray-50 hover:bg-gray-100 rounded-2xl transition-colors"
                      on:click={cancelDelete}
                  >
                      {$t.common.cancel}
                  </button>
                  <button
                      class="flex-1 py-4 text-white font-bold text-sm bg-red-500 hover:bg-red-600 rounded-2xl shadow-lg shadow-red-500/20 transition-colors"
                      on:click={confirmDelete}
                  >
                      {$t.dashboard.yes_delete}
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
                  <h3 class="text-xl font-bold text-gray-900 mb-2">{$t.dashboard.delete_task_prompt}</h3>
                  <p class="text-gray-500 text-sm">
                      {$t.dashboard.delete_task_confirm.replace('{name}', taskToDelete.label)}
                  </p>
              </div>

              <div class="flex space-x-3">
                  <button
                      class="flex-1 py-4 text-gray-600 font-bold text-sm bg-gray-50 hover:bg-gray-100 rounded-2xl transition-colors"
                      on:click={cancelDeleteTask}
                  >
                      {$t.common.cancel}
                  </button>
                  <button
                      class="flex-1 py-4 text-white font-bold text-sm bg-red-500 hover:bg-red-600 rounded-2xl shadow-lg shadow-red-500/20 transition-colors"
                      on:click={confirmDeleteTask}
                  >
                      {$t.dashboard.yes_delete}
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
                          {$t.modals.care}
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
                      <label class="block text-xs font-bold text-gray-500 mb-1 ml-1" for="taskTime">{$t.modals.time}</label>
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
                      {$t.common.cancel}
                  </button>
                  <button
                      class="flex-1 py-4 text-white font-bold text-sm bg-brand-sage hover:bg-brand-sage/90 rounded-2xl shadow-lg shadow-brand-sage/20 transition-colors"
                      on:click={saveOneTimeTask}
                  >
                      {$t.modals.add_task}
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
                  placeholder={$t.modals.household_placeholder}
                  class="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-sage focus:border-transparent mb-4"
              />
              
              <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{$t.settings.timezone}</label>
              <CustomTimezoneSelect
                  bind:value={newHouseholdTimezone}
                  {timezones}
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
                <span>{$activeHousehold?.name || $currentUser?.user_metadata?.first_name || $t.dashboard.household_dropdown}</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform {showHouseholdMenu ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            
            <!-- Dropdown Menu -->
           {#if showHouseholdMenu}
               <!-- Invisible overlay to close dropdown on outside click -->
               <!-- svelte-ignore a11y-click-events-have-key-events -->
               <!-- svelte-ignore a11y-no-static-element-interactions -->
               <div class="fixed inset-0 z-40" on:click|stopPropagation={() => showHouseholdMenu = false}></div>
               
               <div 
                   class="absolute top-full left-0 mt-2 w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-scale-in origin-top-left z-50"
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
                                   {hh.role === 'owner' ? $t.settings.role_owner : $t.settings.role_member}
                               </span>
                           </button>
                       {/each}
                       
                       <!-- Join/Create Option -->
                       <div class="border-t border-gray-100 mt-1 pt-1">
                             <button
                                class="block w-full text-left px-4 py-3 text-xs font-bold text-gray-500 hover:text-brand-sage hover:bg-gray-50 flex items-center"
                                on:click={handleAddHouseholdClick}
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

  <!-- Pending Invites Banner -->
  {#if pendingInvites.length > 0 && showInviteBanner}
    <div class="mx-6 mt-4">
      <button
        on:click={() => goto('/settings#invitations')}
        class="w-full bg-gradient-to-r from-brand-sage to-emerald-500 text-white rounded-2xl p-4 shadow-lg hover:shadow-xl transition-all flex items-center justify-between group"
      >
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div class="text-left">
            <div class="font-bold text-sm">
              {(pendingInvites.length === 1 ? $t.settings.invites_new : $t.settings.invites_new_plural).replace('{n}', pendingInvites.length.toString())}
            </div>
            <div class="text-xs text-white/80">{$t.dashboard.tap_to_view}</div>
          </div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  {/if}

  <main class="p-6 space-y-6">
    {#if loading}
      <div class="flex justify-center py-10">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    {:else if pets.length === 0}
      <div class="text-center py-12 bg-white rounded-2xl p-8 shadow-sm">
        {#if $activeHousehold?.role === 'owner'}
        <p class="text-gray-600 mb-6 text-base">{$t.dashboard.no_pets}</p>
        <button
           data-tour="add-pet-btn"
           class="bg-brand-sage text-white px-6 py-3 rounded-xl font-semibold hover:bg-brand-sage/90 transition-colors inline-block shadow-sm"
           on:click={() => goto('/pets/add')}
        >
          {$t.dashboard.add_first_pet}
        </button>
        {:else}
        <p class="text-gray-600 mb-6 text-base">{$t.dashboard.no_pets_member}</p>
        {/if}

        <div class="mt-6">
            <button
                class="text-sm text-gray-400 hover:text-brand-sage transition-colors underline"
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
                 <div class="w-20 h-20 rounded-full border-2 border-white shadow-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    <PetIcon icon={pet.icon} extraClasses="!w-full !h-full !text-5xl" />
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
        <PremiumFeatureModal
            featureName={$t.dashboard.premium_feature_name}
            featureDescription={$t.dashboard.premium_feature_desc}
            on:close={() => showPremiumModal = false}
        />
    {/if}

    <!-- NOTIFICATION PERMISSION PROMPT -->
    {#if showNotificationPrompt}
        <NotificationPrompt on:close={handleCloseNotificationPrompt} />
    {/if}
{/if}

