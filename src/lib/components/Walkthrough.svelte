<script lang="ts">
  import { onboarding } from '$lib/stores/onboarding';
  import { fade, scale } from 'svelte/transition';

  // Tooltip Logic (Simple absolute positioning near target if needed, 
  // or we can just render fixed centered for modal and use this for the overlay)
  
  // For the 'add-family' tooltip, if we want it to point to the icon, 
  // we might need a reference. But standard "Info Modal" is often cleaner.
  // Let's implement activeTooltip as a small popover.
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
         class="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl relative z-10 text-center"
         in:scale={{ start: 0.95 }}
      >
          <div class="mb-4 text-6xl">👋</div>
          <h2 class="text-2xl font-bold text-gray-900 mb-2">Welcome to WhoFed!</h2>
          <p class="text-gray-500 mb-8 leading-relaxed">
              Track your pet's meals and meds with ease. 
              <br><br>
              <strong>1. Add Pets:</strong> Create profiles for your furry friends.<br>
              <strong>2. Set Schedules:</strong> Get reminders for feeding & meds.<br>
              <strong>3. Invite Family:</strong> Share duties with your household.
          </p>
          
          <button 
              class="w-full bg-brand-sage text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-brand-sage/20 active:scale-95 transition-transform"
              on:click={() => onboarding.dismissWelcome()}
          >
              Got it, let's go!
          </button>
      </div>
  </div>
{/if}

<!-- 2. GENERIC TOOLTIP OVERLAY (If needed globally) -->
<!-- Currently 'add-family' checks activeTooltip locally or here. 
     Since the trigger is in Settings, we can handle it there OR here if we want a global backdrop. 
     Let's handle it here for consistency if it's "modal-like" or simple popover. -->

{#if $onboarding.activeTooltip === 'add-family'}
    <div 
        class="fixed inset-0 z-[70] flex items-center justify-center p-6"
        on:click|self={() => onboarding.hideTooltip()}
    >
       <!-- Invisible blocking layer or dark backdrop? User said "tooltip", 
            but usually these are small popovers interacting with the button. 
            For simplicity and mobile-friendliness, a centered small modal works best 
            OR a positioned popover. Let's do a centered "Info Card" to be safe and clear. -->
       
       <div 
         class="absolute inset-0 bg-black/20" 
         in:fade
         on:click={() => onboarding.hideTooltip()}
       ></div>

       <div 
          class="bg-white rounded-2xl p-6 max-w-xs w-full shadow-xl relative z-10 pointer-events-auto"
          in:scale={{ start: 0.9 }}
       >
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
                   <button 
                       class="text-brand-sage font-bold text-sm hover:underline"
                       on:click={() => onboarding.hideTooltip()}
                   >
                       Close
                   </button>
               </div>
           </div>
       </div>
    </div>
{/if}
