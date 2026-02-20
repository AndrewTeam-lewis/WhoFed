<script lang="ts">
  import { onboarding } from '$lib/stores/onboarding';
  import { fade, scale } from 'svelte/transition';

  // Tooltip Logic (Simple absolute positioning near target if needed, 
  // or we can just render fixed centered for modal and use this for the overlay)
  
  // For the 'add-family' tooltip, if we want it to point to the icon, 
  // we might need a reference. But standard "Info Modal" is often cleaner.
  // Let's implement activeTooltip as a small popover.

  // Carousel State
  let currentSlide = 0;
  const slides = [
    {
      emoji: '👋',
      title: 'Welcome to WhoFed!',
      description: 'The single source of truth for your pet\'s care. Track meals, medication, and litter box duties all in one place.'
    },
    {
      emoji: '👨‍👩‍👧‍👦',
      title: 'No More Double-Feeding',
      description: 'When you check off a task on your Dashboard, everyone in your household sees it instantly.'
    },
    {
      emoji: '🚀',
      title: 'Let\'s Get Started',
      description: 'Add your first pet and set up their schedule to begin tracking!'
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
          <div class="mb-4 text-7xl transition-all duration-300 transform scale-100">
              {slides[currentSlide].emoji}
          </div>
          <h2 class="text-2xl font-black text-gray-900 mb-3 tracking-tight">
              {slides[currentSlide].title}
          </h2>
          <p class="text-gray-500 mb-8 leading-relaxed h-20 flex items-center justify-center">
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
              {currentSlide === slides.length - 1 ? "Start Tracking" : "Next"}
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
                   <h3 class="font-bold text-gray-900 mb-1">Invite Family</h3>
                   <p class="text-sm text-gray-500 mb-4">
                       Tap the <span class="inline-block bg-brand-sage/10 text-brand-sage rounded p-0.5"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 inline" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg></span> button to generate an invite link. Share it with your household members to let them view and log tasks!
                   </p>
                   <button class="text-brand-sage font-bold text-sm hover:underline" on:click={() => onboarding.hideTooltip()}>Close</button>
               </div>
            </div>
            
            <!-- Members Role Tooltip -->
            {:else if $onboarding.activeTooltip === 'members-role'}
            <div class="flex items-start space-x-4">
               <div class="bg-purple-50 text-purple-500 p-3 rounded-xl flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
               </div>
               <div>
                   <h3 class="font-bold text-gray-900 mb-1">How Shared Homes Work</h3>
                   <p class="text-sm text-gray-500 mb-4">
                       As an <strong>Owner</strong>, you can invite new members and add pets. As a <strong>Member</strong>, you have full access to view pets, edit their daily schedules, and check off meals/meds. If you check off a meal, it syncs to everyone else's phone instantly!
                   </p>
                   <button class="text-brand-sage font-bold text-sm hover:underline" on:click={() => onboarding.hideTooltip()}>Got it</button>
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
                   <h3 class="font-bold text-gray-900 mb-1">One-Time vs Recurring</h3>
                   <p class="text-sm text-gray-500 mb-4">
                       Recurring tasks happen every day based on your pet's schedule. Need a one-off reminder (like a vet appointment or a monthly pill)? Tap the <strong>+</strong> button above your task list to create a one-time event!
                   </p>
                   <button class="text-brand-sage font-bold text-sm hover:underline" on:click={() => onboarding.hideTooltip()}>Thanks</button>
               </div>
            </div>
            {/if}
       </div>
    </div>
{/if}
