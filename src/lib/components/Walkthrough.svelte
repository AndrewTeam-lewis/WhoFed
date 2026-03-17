<script lang="ts">
  import { onboarding } from '$lib/stores/onboarding';
  import { fade, scale } from 'svelte/transition';
  import { t } from '$lib/services/i18n';

  // Tooltip Logic (Simple absolute positioning near target if needed, 
  // or we can just render fixed centered for modal and use this for the overlay)
  
  // For the 'add-family' tooltip, if we want it to point to the icon, 
  // we might need a reference. But standard "Info Modal" is often cleaner.
  // Let's implement activeTooltip as a small popover.

  // Carousel State
  let currentSlide = 0;
  $: slides = [
    {
      title: $t.walkthrough.slide1_title,
      description: $t.walkthrough.slide1_desc
    },
    {
      title: $t.walkthrough.slide2_title,
      description: $t.walkthrough.slide2_desc
    },
    {
      title: $t.walkthrough.slide3_title,
      description: $t.walkthrough.slide3_desc
    }
  ];

  function nextSlide() {
    if (currentSlide < slides.length - 1) {
        currentSlide++;
    } else {
        onboarding.dismissWelcome();
        currentSlide = 0; // reset for next time
    }
  }
</script>

<!-- 1. WELCOME MODAL -->
{#if $onboarding.showWelcome}
  <div 
    class="fixed inset-0 z-[60] flex items-center justify-center p-6"
  >
      <!-- Backdrop -->
      <div 
         class="absolute inset-0 bg-black/40 backdrop-blur-sm"
         in:fade
         on:click={() => onboarding.dismissWelcome()}
      ></div>

      <div 
         class="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl relative z-10 text-center overflow-hidden"
         in:scale={{ start: 0.95 }}
      >
          <!-- Slide Content -->
          <div class="mb-6 transition-all duration-300 transform scale-100">
              <img src="/whofed_logo_email_tiny.png" alt="WhoFed Logo" class="w-24 h-24 object-contain mx-auto" />
          </div>
          <h2 class="text-xl font-bold text-gray-900 mb-4 tracking-tight">
              {slides[currentSlide].title}
          </h2>
          <p class="text-gray-600 mb-8 leading-relaxed min-h-[3rem]">
              {slides[currentSlide].description}
          </p>
          
          <!-- Pagination Dots -->
          <div class="flex justify-center gap-2 mb-8">
              {#each slides as _, i}
                  <div class="h-2 rounded-full transition-all duration-300 {i === currentSlide ? 'w-6 bg-brand-sage' : 'w-2 bg-gray-200'}"></div>
              {/each}
          </div>

          <button 
              class="w-full bg-brand-sage text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-brand-sage/20 active:scale-95 transition-transform"
              on:click={nextSlide}
          >
              {currentSlide === slides.length - 1 ? $t.walkthrough.start_tracking : $t.walkthrough.next}
          </button>
      </div>
  </div>
{/if}

<!-- 2. GENERIC TOOLTIP OVERLAY -->
{#if $onboarding.activeTooltip}
    <div 
        class="fixed inset-0 z-[70] flex items-center justify-center p-6"
        on:click|self={() => onboarding.hideTooltip()}
    >
       <div 
         class="absolute inset-0 bg-black/20" 
         in:fade
         on:click={() => onboarding.hideTooltip()}
       ></div>

       <div 
          class="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl relative z-10 pointer-events-auto"
          in:scale={{ start: 0.9 }}
       >
            <!-- Add Family Tooltip -->
           {#if $onboarding.activeTooltip === 'add-family'}
            <div class="flex items-start space-x-4">
               <div class="bg-blue-50 text-blue-500 p-3 rounded-xl">
                   <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" />
                   </svg>
               </div>
               <div>
                   <h3 class="font-bold text-gray-900 mb-1">{$t.walkthrough.invite_family}</h3>
                   <p class="text-sm text-gray-500 mb-4">
                       {$t.walkthrough.invite_family_desc}
                   </p>
                   <button class="text-brand-sage font-bold text-sm hover:underline" on:click={() => onboarding.hideTooltip()}>{$t.walkthrough.close}</button>
               </div>
            </div>
            
            <!-- Members Role Tooltip -->
            {:else if $onboarding.activeTooltip === 'members-role'}
            <div class="flex items-start space-x-4">
               <div class="bg-brand-sage/10 text-brand-sage p-3 rounded-xl flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
               </div>
               <div>
                   <h3 class="font-bold text-gray-900 mb-1">{$t.walkthrough.how_shared_homes}</h3>
                   <p class="text-sm text-gray-500 mb-4">
                       {$t.walkthrough.how_shared_homes_desc}
                   </p>
                   <button class="text-brand-sage font-bold text-sm hover:underline" on:click={() => onboarding.hideTooltip()}>{$t.common.got_it}</button>
               </div>
            </div>

            <!-- One-Time Task Tooltip -->
            {:else if $onboarding.activeTooltip === 'onetime-task'}
            <div class="flex items-start space-x-4">
               <div class="bg-amber-50 text-amber-500 p-3 rounded-xl flex-shrink-0">
                   <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                   </svg>
               </div>
               <div>
                   <h3 class="font-bold text-gray-900 mb-1">{$t.walkthrough.onetime_vs_recurring}</h3>
                   <p class="text-sm text-gray-500 mb-4">
                       {$t.walkthrough.onetime_vs_recurring_desc}
                   </p>
                   <button class="text-brand-sage font-bold text-sm hover:underline" on:click={() => onboarding.hideTooltip()}>{$t.walkthrough.thanks}</button>
               </div>
            </div>
            {/if}
       </div>
    </div>
{/if}
