<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { fade, scale } from 'svelte/transition';

    export let value = ''; // YYYY-MM-DD
    export let placeholder = 'Select Date';

    const dispatch = createEventDispatcher();
    let showModal = false;

    // Calendar state
    let currentDate = new Date(); // To track viewed month
    let selectedDateVal = value ? new Date(value) : null;

    function openModal() {
        if (value) {
            currentDate = new Date(value);
            // Handle timezone offset for display if needed, but simple Date(value) is usually UTC 00:00 for YYYY-MM-DD strings causing shift.
            // Let's use local for UI logic.
            const [y, m, d] = value.split('-').map(Number);
            currentDate = new Date(y, m - 1, d);
            selectedDateVal = new Date(y, m - 1, d);
        } else {
            selectedDateVal = null;
        }
        showModal = true;
    }

    function prevMonth() {
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    }

    function nextMonth() {
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    }

    function selectDate(day: number) {
        const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        selectedDateVal = d;
        
        // Format YYYY-MM-DD
        const y = d.getFullYear();
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const dayStr = d.getDate().toString().padStart(2, '0');
        const str = `${y}-${m}-${dayStr}`;
        
        value = str;
        dispatch('select', str);
        showModal = false;
    }

    $: daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    $: startDayOfWeek = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay(); // 0 is Sunday
    
    // Adjust for Monday start if desired, but standard US Sunday start is fine. 
    // Let's stick to Sunday start (0) for now.
</script>

<button 
    type="button"
    class="flex-1 bg-white rounded-xl px-4 py-2 border border-gray-100 text-sm font-bold text-typography-primary focus:ring-2 focus:ring-brand-sage/20 cursor-pointer hover:border-brand-sage/50 text-left flex items-center justify-between shadow-sm min-w-[8rem]"
    on:click={openModal}
>
    <span class={!value ? 'text-gray-400' : ''}>
        {value ? new Date(value + 'T00:00:00').toLocaleDateString(undefined, {month:'short', day: 'numeric', year: 'numeric'}) : placeholder}
    </span>
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
</button>

{#if showModal}
    <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <!-- Backdrop -->
        <button 
            class="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            on:click={() => showModal = false}
            transition:fade={{ duration: 200 }}
        ></button>

        <!-- Calendar Component -->
        <div 
            class="bg-white w-full max-w-sm rounded-[32px] p-5 shadow-2xl relative z-10 overflow-hidden"
            transition:scale={{ start: 0.95, duration: 200 }}
        >
            <!-- Header -->
            <div class="flex items-center justify-between mb-6">
                <button type="button" class="p-2 hover:bg-gray-100 rounded-full transition-colors" on:click={prevMonth}>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div class="text-lg font-bold text-typography-primary">
                    {currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </div>
                <button type="button" class="p-2 hover:bg-gray-100 rounded-full transition-colors" on:click={nextMonth}>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>

            <!-- Days Header -->
            <div class="grid grid-cols-7 mb-2">
                {#each ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as day}
                    <div class="text-center text-xs font-bold text-gray-300">{day}</div>
                {/each}
            </div>

            <!-- Days Grid -->
            <div class="grid grid-cols-7 gap-1">
                <!-- Empty slots -->
                {#each Array(startDayOfWeek) as _}
                    <div></div>
                {/each}

                <!-- Days -->
                {#each Array(daysInMonth) as _, i}
                    {@const d = i + 1}
                    {@const isSelected = selectedDateVal && selectedDateVal.getDate() === d && selectedDateVal.getMonth() === currentDate.getMonth() && selectedDateVal.getFullYear() === currentDate.getFullYear()}
                    {@const isToday = d === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear()}
                    
                    <button 
                        type="button"
                        class="aspect-square flex items-center justify-center rounded-full text-sm font-bold transition-all
                        {isSelected ? 'bg-brand-sage text-white shadow-md scale-105' : 
                         isToday ? 'bg-brand-sage/10 text-brand-sage' : 
                         'text-typography-primary hover:bg-gray-100'}"
                        on:click={() => selectDate(d)}
                    >
                        {d}
                    </button>
                {/each}
            </div>

            <!-- Footer -->
            <div class="mt-6 flex justify-end">
                <button 
                    class="text-sm font-bold text-gray-400 hover:text-typography-primary px-4 py-2"
                    on:click={() => showModal = false}
                >
                    Cancel
                </button>
            </div>
        </div>
    </div>
{/if}
