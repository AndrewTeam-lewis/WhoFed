<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { userIsPremium } from '$lib/stores/user';
  import { t, formatDateTime } from '$lib/services/i18n';
  import type { Database } from '$lib/database.types';

  type ActivityLog = Database['public']['Tables']['activity_log']['Row'] & {
    profiles: { first_name: string | null } | null;
    schedules: { label: string | null, task_type: string } | null;
    daily_tasks: { label: string | null } | null;
  };

  let loading = true;
  let logs: ActivityLog[] = [];
  let petName = '...';
  
  $: petId = $page.params.id;

  onMount(async () => {
    if (!petId) return;
    await fetchPetDetails();
    await fetchLogs();
    loading = false;
  });

  let isLocked = false;

  async function fetchPetDetails() {
      const { data } = await supabase
        .from('pets')
        .select('name')
        .eq('id', petId)
        .single();

      if (data) {
          petName = data.name;
      }
  }

  async function fetchLogs() {
      const now = new Date();
      let startTime = new Date();

      if ($userIsPremium) {
          // Premium: 1 Year History
          startTime.setFullYear(now.getFullYear() - 1);
      } else {
          // Free: 3 Days History
          startTime.setDate(now.getDate() - 3);
      }

      const { data } = await supabase
        .from('activity_log')
        .select('*, profiles(first_name), schedules(label, task_type), daily_tasks(label)')
        .eq('pet_id', petId)
        .gte('performed_at', startTime.toISOString())
        .order('performed_at', { ascending: false })
        .limit(100); // Sanity limit

      // Filter out undone actions
      const undoneTaskIds = new Set<string>();
      const filteredLogs = [];

      for (const row of (data || [])) {
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

      logs = filteredLogs;

      // 2. Check if we should show the "Unlock" banner
      if (!$userIsPremium) {
          // Check if ANY records exist older than our start time
          const { count } = await supabase
              .from('activity_log')
              .select('id', { count: 'exact', head: true })
              .eq('pet_id', petId)
              .lt('performed_at', startTime.toISOString());

          isLocked = (count || 0) > 0;
      } else {
          isLocked = false;
      }
  }

  function formatTimestamp(isoString: string) {
    return $formatDateTime(isoString);
  }

  function getActivityIcon(actionType: string): string {
    switch(actionType) {
      case 'feeding': return '🍽️';
      case 'medication': return '💊';
      case 'care': return '❤️';
      default: return '•';
    }
  }

  function getActivityLabel(log: ActivityLog): string {
    const scheduleLabel = log.schedules?.label;
    const dailyLabel = log.daily_tasks?.label;
    const label = scheduleLabel || dailyLabel;

    if (label) {
      return label;
    }

    // Fallback to action type
    switch(log.action_type) {
      case 'feeding': return $t.history.feeding || 'Feeding';
      case 'medication': return $t.history.medication || 'Medication';
      case 'care': return $t.history.care || 'Care';
      default: return log.action_type;
    }
  }
</script>

<div class="min-h-screen bg-neutral-bg pb-24 font-sans text-typography-primary">
    <!-- Top Nav -->
    <header class="bg-neutral-bg px-6 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center">
        <button on:click={() => goto('/')} class="mr-4 p-2 -ml-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
            </svg>
        </button>
        <div>
            <h1 class="text-xl font-bold text-typography-primary">{$t.history.page_title}</h1>
            <p class="text-sm text-gray-500">{petName}</p>
        </div>
    </header>

    <main class="p-6 max-w-lg mx-auto">
        {#if loading}
             <div class="flex justify-center py-10">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-sage"></div>
             </div>
        {:else}
             <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {#if logs.length === 0}
                    <div class="p-8 text-center">
                        <div class="text-4xl mb-3">📋</div>
                        <p class="text-gray-500 font-medium">{$t.history.no_activity || 'No activity yet'}</p>
                        <p class="text-xs text-gray-400 mt-1">{$t.history.no_activity_desc || 'Activity will appear here when you log tasks'}</p>
                    </div>
                {:else}
                    <ul class="divide-y divide-gray-100">
                    {#each logs as log}
                        <li class="p-4 hover:bg-gray-50 transition-colors animate-fade-in">
                             <div class="flex items-start gap-3">
                                <!-- Activity Icon -->
                                <div class="flex-shrink-0 text-xl mt-0.5">
                                    {getActivityIcon(log.action_type)}
                                </div>

                                <!-- Activity Info -->
                                <div class="flex-1 min-w-0">
                                    <!-- Activity Label (Bold, prominent) -->
                                    <div class="font-bold text-gray-900 text-sm mb-0.5">
                                        {getActivityLabel(log)}
                                    </div>

                                    <!-- Person • Timestamp (Smaller, gray) -->
                                    <div class="text-xs text-gray-500 flex items-center gap-1.5">
                                        <span>{log.profiles?.first_name || $t.history.someone}</span>
                                        <span class="text-gray-300">•</span>
                                        <span>{formatTimestamp(log.performed_at)}</span>
                                    </div>
                                </div>
                             </div>
                        </li>
                    {/each}
                </ul>
                {/if}

                {#if isLocked}
                    <!-- Premium Lock Upsell -->
                    <div class="relative">
                        <!-- Blur Overlay -->
                        <div class="absolute -top-10 left-0 right-0 h-10 bg-gradient-to-b from-transparent to-white/90 pointer-events-none"></div>
                        
                        <div class="bg-gray-50 p-6 text-center border-t border-gray-100 flex flex-col items-center justify-center">
                            <div class="bg-gray-200 rounded-full p-3 mb-3 text-gray-500">
                                 <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                 </svg>
                            </div>
                            <h3 class="font-bold text-gray-900 mb-1">{$t.history.unlock_title}</h3>
                            <p class="text-xs text-gray-500 mb-4 max-w-[200px]">{$t.history.unlock_desc}</p>
                            <button 
                                class="bg-brand-sage text-white text-sm font-bold py-3 px-8 rounded-xl shadow-lg hover:bg-brand-sage/90 transition-all"
                                on:click={() => alert('Premium Upgrade coming soon!')}
                            >
                                {$t.history.upgrade_now}
                            </button>
                        </div>
                    </div>
                {/if}
             </div>
        {/if}
    </main>
</div>
