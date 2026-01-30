<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
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

  async function fetchPetDetails() {
      const { data } = await supabase
        .from('pets')
        .select('name')
        .eq('id', petId)
        .single();
      
      if (data) petName = data.name;
  }

  async function fetchLogs() {
      const { data } = await supabase
        .from('activity_log')
        .select('*, profiles(first_name), schedules(label, task_type), daily_tasks(label)')
        .eq('pet_id', petId)
        .order('performed_at', { ascending: false })
        .limit(100);
        
      logs = data || [];
  }

  function formatTimeAgo(isoString: string) {
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
            <h1 class="text-xl font-bold text-typography-primary">Activity History</h1>
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
                <ul class="divide-y divide-gray-100">
                    {#each logs as log}
                        <li class="p-3 flex justify-between items-center hover:bg-gray-50 transition-colors animate-fade-in">
                             <div class="flex items-center gap-3 min-w-0">
                                <!-- Minimal Indicator -->
                                <div class="flex-shrink-0 w-2 h-2 rounded-full bg-gray-800"></div>

                                <div class="text-sm truncate text-gray-800">
                                    <span>{log.profiles?.first_name || 'Someone'}</span>
                                    
                                    {#if log.action_type === 'feeding'}
                                        fed
                                    {:else if log.action_type === 'unfed'}
                                        <span class="text-red-500">un-fed</span>
                                    {:else if log.action_type === 'unmedicated'}
                                        <span class="text-red-500">un-gave</span>
                                    {:else}
                                        gave
                                    {/if}

                                    {#if log.schedules?.label || log.daily_tasks?.label}
                                        <span class="capitalize">
                                            {(log.schedules?.label ?? log.daily_tasks?.label ?? '').toLowerCase()}
                                        </span>
                                    {:else if !log.action_type.includes('feeding') && !log.action_type.includes('unfed')}
                                        <span>meds</span>
                                    {/if}
                                </div>
                             </div>
                             
                             <div class="text-xs font-medium text-gray-400 whitespace-nowrap ml-4 flex-shrink-0">
                                 {formatTimeAgo(log.performed_at)}
                             </div>
                        </li>
                    {/each}
                </ul>
             </div>
        {/if}
    </main>
</div>
