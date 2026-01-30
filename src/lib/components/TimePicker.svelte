<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { fade, scale } from 'svelte/transition';

    export let value = '08:00'; // HH:MM 24h format
    export let label = '';

    const dispatch = createEventDispatcher();
    let showModal = false;

    // Internal state for the picker
    let selectedHour = '08';
    let selectedMinute = '00';
    let selectedPeriod = 'AM';

    function parseValue(val: string) {
        if (!val) return;
        const [h, m] = val.split(':');
        let hourInt = parseInt(h);
        const minute = m;

        selectedPeriod = hourInt >= 12 ? 'PM' : 'AM';
        if (hourInt > 12) hourInt -= 12;
        if (hourInt === 0) hourInt = 12;

        selectedHour = hourInt.toString().padStart(2, '0');
        selectedMinute = minute;
    }

    function openModal() {
        parseValue(value);
        showModal = true;
    }

    function confirm() {
        let h = parseInt(selectedHour);
        if (selectedPeriod === 'PM' && h !== 12) h += 12;
        if (selectedPeriod === 'AM' && h === 12) h = 0;

        const newValue = `${h.toString().padStart(2, '0')}:${selectedMinute}`;
        value = newValue;
        dispatch('change', newValue);
        showModal = false;
    }

    // Generate options
    const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
    const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0')); // 5 min steps
</script>

<!-- Trigger Button -->
<button 
    type="button"
    class="bg-white rounded-lg px-3 py-1.5 border border-gray-100 text-typography-primary font-bold focus:ring-2 focus:ring-brand-sage/20 p-0 text-base min-w-[6rem] text-center shadow-sm cursor-pointer hover:border-brand-sage/50 transition-all flex items-center justify-center space-x-2"
    on:click={openModal}
>
    <span>
        {(() => {
            if (!value) return '--:--';
            const [h, m] = value.split(':');
            let hour = parseInt(h);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            if (hour > 12) hour -= 12;
            if (hour === 0) hour = 12;
            return `${hour}:${m} ${ampm}`;
        })()}
    </span>
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
</button>

<!-- Modal -->
{#if showModal}
    <div class="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-4">
        <!-- Backdrop -->
        <button 
            class="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            on:click={() => showModal = false}
            transition:fade={{ duration: 200 }}
        ></button>

        <!-- Content -->
        <div 
            class="bg-white w-full max-w-sm rounded-[32px] p-5 pt-8 shadow-2xl relative z-10"
            transition:scale={{ start: 0.95, duration: 200 }}
        >
            <div class="flex items-start justify-center space-x-2 mb-8 h-48">
                <!-- Hours -->
                <div class="flex flex-col items-center h-full overflow-y-auto w-16 no-scrollbar py-2 bg-gray-50 rounded-2xl relative">
                    {#each hours as h}
                        <button 
                            type="button"
                            class="w-full py-2 flex-shrink-0 text-xl font-bold transition-colors {selectedHour === h ? 'text-brand-sage scale-110' : 'text-gray-300'}"
                            on:click={() => selectedHour = h}
                        >
                            {h}
                        </button>
                    {/each}
                </div>

                <div class="self-center font-bold text-gray-300 text-2xl pb-1">:</div>

                <!-- Minutes -->
                <div class="flex flex-col items-center h-full overflow-y-auto w-16 no-scrollbar py-2 bg-gray-50 rounded-2xl">
                    {#each minutes as m}
                        <button 
                            type="button"
                            class="w-full py-2 flex-shrink-0 text-xl font-bold transition-colors {selectedMinute === m ? 'text-brand-sage scale-110' : 'text-gray-300'}"
                            on:click={() => selectedMinute = m}
                        >
                            {m}
                        </button>
                    {/each}
                </div>

                <!-- AM/PM -->
                <div class="flex flex-col items-center justify-center h-full space-y-2 ml-4">
                    <button 
                        type="button"
                        class="w-12 py-3 rounded-xl font-bold text-sm transition-all {selectedPeriod === 'AM' ? 'bg-brand-sage text-white shadow-md' : 'bg-gray-100 text-gray-400'}"
                        on:click={() => selectedPeriod = 'AM'}
                    >
                        AM
                    </button>
                    <button 
                        type="button"
                        class="w-12 py-3 rounded-xl font-bold text-sm transition-all {selectedPeriod === 'PM' ? 'bg-brand-sage text-white shadow-md' : 'bg-gray-100 text-gray-400'}"
                        on:click={() => selectedPeriod = 'PM'}
                    >
                        PM
                    </button>
                </div>
            </div>

            <!-- Actions -->
            <div class="flex space-x-3">
                <button 
                    class="flex-1 py-4 text-center font-bold text-gray-400 hover:bg-gray-50 rounded-2xl transition-colors"
                    on:click={() => showModal = false}
                >
                    Cancel
                </button>
                <button 
                    class="flex-1 py-4 text-center font-bold bg-brand-sage text-white rounded-2xl shadow-lg hover:bg-brand-sage/90 transition-all"
                    on:click={confirm}
                >
                    Set Time
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    /* Hide scrollbar for Chrome, Safari and Opera */
    .no-scrollbar::-webkit-scrollbar {
        display: none;
    }
    /* Hide scrollbar for IE, Edge and Firefox */
    .no-scrollbar {
        -ms-overflow-style: none;  /* IE and Edge */
        scrollbar-width: none;  /* Firefox */
    }
</style>
