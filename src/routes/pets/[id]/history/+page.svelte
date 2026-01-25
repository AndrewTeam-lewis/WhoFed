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
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    // If > 24h, show Date + Time
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
</script>

<div class="min-h-screen bg-neutral-bg pb-24 font-sans text-typography-primary">
    <!-- Top Nav -->
    <header class="bg-neutral-bg px-6 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center">
        <button on:click={() => goto('/')} class="p-3 bg-white rounded-full shadow-soft hover:scale-105 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-typography-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
            </svg>
        </button>
        <div class="text-center">
            <h1 class="text-base font-bold text-typography-primary">Activity History</h1>
            <p class="text-xs text-typography-secondary">{petName}</p>
        </div>
        <div class="w-10"></div> <!-- Spacer for balance -->
    </header>

    <main class="p-6 max-w-lg mx-auto">
        {#if loading}
             <div class="flex justify-center py-10">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-sage"></div>
             </div>
        {:else if logs.length === 0}
             <div class="text-center py-10 opacity-50">
                 <p>No activity recorded yet.</p>
             </div>
        {:else}
             <div class="space-y-6 relative border-l-2 border-gray-100 ml-3 pl-6">
                {#each logs as log}
                    <div class="relative animate-fade-in">
                        <!-- Timeline Dot -->
                        <div class="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full border-2 {log.action_type.startsWith('un') ? 'border-red-300 bg-red-50' : 'border-brand-sage bg-white'}"></div>
                        
                        <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-50 flex justify-between items-start">
                             <div>
                                <div class="text-sm text-gray-800">
                                    <span class="font-bold">{log.profiles?.first_name || 'Someone'}</span>
                                    
                                    {#if log.action_type === 'feeding'}
                                        fed <span class="font-medium text-gray-600">{petName}</span>
                                        {#if log.schedules?.label || log.daily_tasks?.label}
                                            <span class="text-gray-400 text-xs ml-1 uppercase tracking-wide px-1.5 py-0.5 bg-gray-100 rounded-md">{log.schedules?.label ?? log.daily_tasks?.label}</span>
                                        {/if}
                                    {:else if log.action_type === 'unfed'}
                                        <span class="text-red-500 font-bold">un-fed</span> <span class="font-medium text-gray-600">{petName}</span>
                                    {:else if log.action_type === 'unmedicated'}
                                        <span class="text-red-500 font-bold">un-gave</span> meds to
                                    {:else}
                                        gave meds
                                        {#if log.schedules?.label || log.daily_tasks?.label}
                                            <span class="text-gray-400 text-xs ml-1 uppercase tracking-wide px-1.5 py-0.5 bg-gray-100 rounded-md">{log.schedules?.label ?? log.daily_tasks?.label}</span>
                                        {/if}
                                    {/if}
                                </div>
                             </div>
                             <div class="text-[10px] font-bold text-gray-400 whitespace-nowrap mt-1 ml-2">
                                 {formatTimeAgo(log.performed_at)}
                             </div>
                        </div>
                    </div>
                {/each}
             </div>
        {/if}
    </main>
</div>
