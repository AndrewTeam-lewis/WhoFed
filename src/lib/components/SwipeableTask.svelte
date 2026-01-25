<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { swipe } from '$lib/actions';
  import type { Database } from '$lib/database.types';

  type DailyTask = Database['public']['Tables']['daily_tasks']['Row'] & {
      schedule_id?: string
  };

  export let task: DailyTask;
  export let visuals: any; // Passed from parent for consistency
  export let isDone: boolean;
  export let isLocked: boolean = false;
  export let isShaking: boolean = false;
  export let isPulsing: boolean = false;

  const dispatch = createEventDispatcher();

  let offsetX = 0;
  let isDragging = false;
  let containerWidth = 0;

  function handlePanMove(event: CustomEvent) {
      const { dx } = event.detail;
      // Limit swipe to left only? Or both? User said "both L and R".
      // But usually delete is one way.
      // Let's allow free movement but resistance.
      
      offsetX = dx;
      isDragging = true;
  }

  function handlePanEnd(event: CustomEvent) {
      isDragging = false; 
      const { dx } = event.detail;
      
      // Threshold to trigger delete
      if (Math.abs(dx) > 100) {
          // Trigger
          dispatch('delete', task);
          // Snap back visually after a moment or stay? 
          // Usually stays if deleted, but we prompt modal.
          // So snap back so it looks normal behind the modal.
          offsetX = 0;
      // Snap back
          offsetX = 0;
      }
  }

  function handleClick() {
      if (Math.abs(offsetX) > 5) return; // Prevent click if dragging
      dispatch('click', task);
  }

  // Styles dynamically based on state
  $: containerClass = `
      relative w-full rounded-2xl overflow-hidden group mb-2
      ${isShaking ? 'animate-shake' : ''}
      ${isPulsing ? 'scale-[1.02] ring-2 ring-brand-sage shadow-lg transition-all duration-200' : ''}
  `;

  $: buttonClass = `
        w-full relative overflow-hidden transition-all duration-300 transform font-bold text-left flex items-center justify-between rounded-2xl
        ${isDone 
            ? 'p-2 bg-transparent text-gray-300 border border-dashed border-gray-200' 
            : (visuals.isUrgent && !isLocked)
                ? 'p-3.5 bg-brand-sage text-white shadow-lg shadow-brand-sage/20 ring-1 ring-brand-sage'
                : 'p-3.5 bg-white text-gray-600 border border-gray-200 shadow-sm hover:border-gray-300'}
        ${isLocked ? 'cursor-not-allowed bg-gray-50 text-gray-400' : ''}
  `;
</script>

<style>
  @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-5px); }
      40% { transform: translateX(5px); }
      60% { transform: translateX(-5px); }
      80% { transform: translateX(5px); }
  }
  .animate-shake {
      animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
  }
</style>

<div class={containerClass} bind:clientWidth={containerWidth}>
    <!-- Background Layer (Delete Actions) -->
    <div class="absolute inset-0 flex items-center justify-between px-6 bg-red-500 text-white rounded-2xl">
        <div class="flex items-center space-x-2 font-bold opacity-{Math.min(1, Math.abs(offsetX)/50)} transition-opacity">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Delete</span>
        </div>
        <div class="flex items-center space-x-2 font-bold opacity-{Math.min(1, Math.abs(offsetX)/50)} transition-opacity">
             <span>Delete</span>
             <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
        </div>
    </div>

    <!-- Foreground Layer (The Task) -->
    <div 
        class="relative bg-white rounded-2xl z-10 {isDragging ? '' : 'transition-transform duration-200 ease-out'}"
        style="transform: translateX({offsetX}px); cursor: {isLocked ? 'not-allowed' : 'grab'}; touch-action: pan-y;"
        use:swipe={{ threshold: 50 }}
        on:panmove={handlePanMove}
        on:panend={handlePanEnd}
    >
        <button 
            on:click={handleClick}
            class={buttonClass}
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
                    {visuals.timeFormatted}
                </div>
            {/if}
        </button>
    </div>
</div>
