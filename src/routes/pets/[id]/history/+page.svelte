<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import type { Database } from '$lib/database.types';

  type Pet = Database['public']['Tables']['pets']['Row'];
  // We extend the type manually because the join return type is complex
  type ActivityLogWithUser = {
    id: string;
    action_type: string;
    performed_at: string;
    profiles: { first_name: string | null } | null;
  };

  let petId = $page.params.id;
  let pet: Pet | null = null;
  let logs: ActivityLogWithUser[] = [];
  let groupedLogs: { date: string; items: ActivityLogWithUser[] }[] = [];
  let loading = true;

  onMount(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      goto('/auth/login');
      return;
    }

    await loadData();
  });

  async function loadData() {
    loading = true;
    try {
      // Fetch Pet
      const { data: petData, error: petError } = await supabase
        .from('pets')
        .select('*')
        .eq('id', petId)
        .single();
      
      if (petError) throw petError;
      pet = petData;

      // Fetch Logs
      const { data: logData, error: logError } = await supabase
        .from('activity_log')
        .select(`
            id,
            action_type,
            performed_at,
            profiles (first_name)
        `)
        .eq('pet_id', petId)
        .order('performed_at', { ascending: false })
        .limit(50); // Limit to last 50 for now

      if (logError) throw logError;
      
      // Type assertion because Supabase types with joins can be tricky
      logs = (logData as any[]) || [];
      groupLogsByDate();

    } catch (error) {
      console.error('Error loading history:', error);
      alert('Failed to load history');
    } finally {
      loading = false;
    }
  }

  function groupLogsByDate() {
      const groups: { [key: string]: ActivityLogWithUser[] } = {};
      
      logs.forEach(log => {
          const date = new Date(log.performed_at);
          const today = new Date();
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);

          let dateKey = date.toLocaleDateString();
          
          if (date.toDateString() === today.toDateString()) {
              dateKey = 'Today';
          } else if (date.toDateString() === yesterday.toDateString()) {
              dateKey = 'Yesterday';
          }

          if (!groups[dateKey]) {
              groups[dateKey] = [];
          }
          groups[dateKey].push(log);
      });

      // Convert to array
      // Note: 'Today' and 'Yesterday' sort logic is manual, but since source logs are ordered by time, keys should appear roughly in order if we respect iteration, but objects aren't ordered.
      // Better to reconstruct based on log order.
      
      // Simpler approach: Iterate logs and build groups array preserving order
      const orderedGroups: { date: string; items: ActivityLogWithUser[] }[] = [];
      let currentDate = '';

      logs.forEach(log => {
          const date = new Date(log.performed_at);
          const today = new Date();
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);

          let dateLabel = date.toLocaleDateString();
          if (date.toDateString() === today.toDateString()) dateLabel = 'Today';
          else if (date.toDateString() === yesterday.toDateString()) dateLabel = 'Yesterday';

          if (dateLabel !== currentDate) {
              orderedGroups.push({ date: dateLabel, items: [] });
              currentDate = dateLabel;
          }
          orderedGroups[orderedGroups.length - 1].items.push(log);
      });
      
      groupedLogs = orderedGroups;
  }

  function formatTime(isoString: string) {
    return new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function exportHistory() {
      // Placeholder for export
      alert("Export functionality coming soon!");
  }
</script>

<svelte:head>
  <title>History - {pet?.name || 'Pet'}</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 pb-20">
  <!-- Header -->
  <header class="bg-white px-6 py-4 flex items-center sticky top-0 z-10 shadow-sm">
    <a href="/" class="mr-4 text-gray-500 hover:text-gray-900">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
    </a>
    <h1 class="text-xl font-bold text-gray-900">{pet ? `${pet.name}'s History` : 'History'}</h1>
  </header>

  <main class="p-6 max-w-lg mx-auto">
    {#if loading}
      <div class="flex justify-center">
        <div class="animate-spin h-8 w-8 border-2 border-primary-500 rounded-full border-t-transparent"></div>
      </div>
    {:else if logs.length === 0}
      <div class="text-center py-10 bg-white rounded-2xl p-6 shadow-sm">
        <p class="text-gray-500">No activity recorded yet.</p>
      </div>
    {:else}
      <div class="space-y-6">
        {#each groupedLogs as group}
          <div>
            <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">{group.date}</h3>
            <div class="bg-white rounded-2xl shadow-sm divide-y divide-gray-100 overflow-hidden">
              {#each group.items as log}
                <div class="p-4 flex items-center justify-between">
                   <div>
                     <div class="font-medium text-gray-900">
                       {formatTime(log.performed_at)} 
                       <span class="text-gray-400 mx-1">-</span> 
                       <span class="capitalize">{log.action_type === 'feeding' ? 'Fed' : 'Medication given'}</span>
                     </div>
                     <div class="text-xs text-gray-500 mt-0.5">
                       by {log.profiles?.first_name || 'Family Member'}
                     </div>
                   </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>

      <div class="mt-8">
        <button 
            on:click={exportHistory}
            class="w-full py-3 bg-primary-500 text-white font-medium rounded-xl shadow-lg shadow-primary-500/30 hover:bg-primary-600 transition-colors flex items-center justify-center space-x-2"
        >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export History</span>
        </button>
      </div>
    {/if}
  </main>
</div>
