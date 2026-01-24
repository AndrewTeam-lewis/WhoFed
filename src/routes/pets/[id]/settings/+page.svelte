<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import type { Database } from '$lib/database.types';

  type Pet = Database['public']['Tables']['pets']['Row'];
  type Schedule = Database['public']['Tables']['schedules']['Row'];

  let petId = $page.params.id;
  let pet: Pet | null = null;
  let schedules: Schedule[] = [];
  let loading = true;
  let saving = false;

  // Form State
  let petName = '';
  let petSpecies = '';

  // New Schedule State
  let showAddSchedule = false;
  let newScheduleType: 'feeding' | 'medication' = 'feeding';
  let newScheduleLabel = '';

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
      petName = pet.name;
      petSpecies = pet.species;

      // Fetch Schedules
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedules')
        .select('*')
        .eq('pet_id', petId)
        .order('id', { ascending: true }); // Ordering by ID since created_at is not available

      if (scheduleError && scheduleError.code !== 'PGRST116') throw scheduleError;
      schedules = scheduleData || [];

    } catch (error) {
      console.error('Error loading settings:', error);
      alert('Failed to load settings');
      goto('/');
    } finally {
      loading = false;
    }
  }

  async function savePetDetails() {
    if (!pet) return;
    saving = true;
    try {
      const { error } = await supabase
        .from('pets')
        .update({
            name: petName,
            species: petSpecies
        })
        .eq('id', pet.id);

      if (error) throw error;
      alert('Saved successfully');
    } catch (error) {
      console.error('Error saving pet:', error);
      alert('Failed to save changes');
    } finally {
      saving = false;
    }
  }

  async function toggleSchedule(schedule: Schedule) {
    try {
        const { error } = await supabase
            .from('schedules')
            .update({ is_enabled: !schedule.is_enabled })
            .eq('id', schedule.id);
            
        if (error) throw error;
        // Optimistic update
        const idx = schedules.findIndex(s => s.id === schedule.id);
        if (idx !== -1) {
            schedules[idx].is_enabled = !schedule.is_enabled;
        }
    } catch (error) {
        console.error('Error toggling schedule:', error);
        alert('Failed to update schedule');
    }
  }

  async function addSchedule() {
    if (!newScheduleLabel) return;
    try {
        const { data, error } = await supabase
            .from('schedules')
            .insert({
                pet_id: petId,
                task_type: newScheduleType,
                label: newScheduleLabel,
                is_enabled: true,
                schedule_mode: 'interval' // default, using interval for everything per constraint
            })
            .select()
            .single();

        if (error) throw error;
        
        schedules = [...schedules, data];
        showAddSchedule = false;
        newScheduleLabel = '';
        newScheduleType = 'feeding';
    } catch (error) {
        console.error('Error adding schedule:', error);
        alert('Failed to add schedule');
    }
  }
  
  async function deleteSchedule(id: string) {
      if(!confirm('Are you sure you want to delete this schedule?')) return;
      try {
          const { error } = await supabase
            .from('schedules')
            .delete()
            .eq('id', id);
            
          if (error) throw error;
          schedules = schedules.filter(s => s.id !== id);
      } catch(error) {
          console.error("Error deleting schedule", error);
          alert("Failed to delete schedule");
      }
  }
</script>

<svelte:head>
  <title>Settings - {pet?.name || 'Pet'}</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 pb-20">
  <!-- Header -->
  <header class="bg-white px-6 py-4 flex items-center sticky top-0 z-10 shadow-sm">
    <a href="/" class="mr-4 text-gray-500 hover:text-gray-900">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
    </a>
    <h1 class="text-xl font-bold text-gray-900">Pet Settings</h1>
  </header>

  <main class="p-6 max-w-lg mx-auto space-y-8">
    {#if loading}
      <div class="flex justify-center">
        <div class="animate-spin h-8 w-8 border-2 border-primary-500 rounded-full border-t-transparent"></div>
      </div>
    {:else if pet}
      <!-- Pet Identity Section -->
      <section class="bg-white rounded-2xl p-6 shadow-sm">
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold text-gray-900">{petName || pet.name}</h2>
            <button class="text-gray-400 hover:text-primary-500">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
            </button>
        </div>

        <div class="space-y-4">
            <div>
                <label for="name" class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Pet Name</label>
                <input 
                    id="name" 
                    type="text" 
                    bind:value={petName} 
                    class="w-full border border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
            </div>
             <div>
                <label for="species" class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Species</label>
                <!-- Simple selector for now -->
                <div class="grid grid-cols-4 gap-2">
                    {#each ['dog', 'cat', 'bird', 'other'] as type}
                        <button 
                            class="flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all
                            {petSpecies === type ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-100 text-gray-500 hover:border-gray-200'}"
                            on:click={() => petSpecies = type}
                        >
                            <span class="text-xl mb-1">
                                {type === 'dog' ? '🐶' : type === 'cat' ? '🐱' : type === 'bird' ? '🐦' : '🐹'}
                            </span>
                            <span class="text-xs font-medium capitalize">{type}</span>
                        </button>
                    {/each}
                </div>
            </div>
        </div>
      </section>

      <!-- Schedules Section -->
      <section>
          <div class="flex justify-between items-center mb-4">
              <h3 class="font-bold text-gray-900">Schedules</h3>
          </div>

          <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
             {#if schedules.length === 0}
                <div class="p-6 text-center text-gray-500 text-sm">
                    No schedules set up yet.
                </div>
             {:else}
                <div class="divide-y divide-gray-100">
                    {#each schedules as schedule}
                        <div class="p-4 flex items-center justify-between">
                            <div class="flex items-center space-x-3">
                                <span class="text-xl">
                                    {schedule.task_type === 'feeding' ? '🥣' : '💊'}
                                </span>
                                <div>
                                    <div class="font-medium text-gray-900">{schedule.label || schedule.task_type}</div>
                                    <div class="text-xs text-gray-500 capitalize">{schedule.task_type}</div>
                                </div>
                            </div>
                            
                            <div class="flex items-center space-x-3">
                                <!-- Delete Button -->
                                <button class="text-gray-300 hover:text-red-500" on:click={() => deleteSchedule(schedule.id)}>
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>

                                <!-- Toggle -->
                                <button 
                                    class="w-12 h-6 rounded-full transition-colors relative {schedule.is_enabled ? 'bg-primary-500' : 'bg-gray-200'}"
                                    on:click={() => toggleSchedule(schedule)}
                                >
                                    <div class="w-4 h-4 bg-white rounded-full absolute top-1 transition-all {schedule.is_enabled ? 'left-7' : 'left-1'}"></div>
                                </button>
                            </div>
                        </div>
                    {/each}
                </div>
             {/if}
             
             <!-- Add New Schedule Form -->
             {#if showAddSchedule}
                <div class="p-4 bg-gray-50 border-t border-gray-100 animate-fade-in">
                    <div class="flex space-x-2 mb-3">
                         <button 
                            class="flex-1 py-1 text-xs font-medium rounded-md border {newScheduleType === 'feeding' ? 'bg-white border-primary-500 text-primary-600' : 'border-transparent text-gray-500'}"
                            on:click={() => newScheduleType = 'feeding'}
                        >Feeding</button>
                        <button 
                            class="flex-1 py-1 text-xs font-medium rounded-md border {newScheduleType === 'medication' ? 'bg-white border-primary-500 text-primary-600' : 'border-transparent text-gray-500'}"
                            on:click={() => newScheduleType = 'medication'}
                        >Medication</button>
                    </div>
                    <div class="flex space-x-2">
                        <input 
                            type="text" 
                            bind:value={newScheduleLabel}
                            placeholder="e.g. Breakfast or Heartworm" 
                            class="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
                        />
                        <button 
                            on:click={addSchedule}
                            class="bg-primary-500 text-white px-4 rounded-lg text-sm font-medium hover:bg-primary-600"
                        >Add</button>
                    </div>
                </div>
             {:else}
                <button 
                    on:click={() => showAddSchedule = true}
                    class="w-full py-3 text-sm font-medium text-primary-500 hover:bg-gray-50 transition-colors border-t border-gray-100"
                >
                    + Add Schedule
                </button>
             {/if}
          </div>
      </section>

      <!-- Save Button -->
      <div class="pt-4">
          <button 
            on:click={savePetDetails}
            class="w-full h-12 bg-primary-500 text-white font-semibold rounded-xl shadow-lg shadow-primary-500/30 hover:bg-primary-600 transition-all flex items-center justify-center transform active:scale-95"
            disabled={saving}
          >
            {#if saving}Saving...{:else}Save All Changes{/if}
          </button>
          
          <div class="text-center mt-4">
            <button class="text-sm text-gray-400 hover:text-gray-600">Discard Changes</button>
          </div>
      </div>
    {/if}
  </main>
</div>
