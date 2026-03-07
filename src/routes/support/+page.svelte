<script lang="ts">
  import { t } from '$lib/services/i18n';
</script>

<svelte:head>
  <title>Support - WhoFed</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 pb-20">
  <!-- Header -->
  <header class="bg-gray-50 px-6 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center">
    <a href="/settings" class="mr-4 p-2 -ml-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-all" aria-label="Back">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
      </svg>
    </a>
    <h1 class="text-xl font-bold text-gray-900">{$t.support.title}</h1>
  </header>

  <main class="p-6 max-w-lg mx-auto space-y-6">

    <!-- How it Works section -->
    <div class="space-y-4">
      <h2 class="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">{$t.support.how_it_works}</h2>

      <section class="bg-white rounded-2xl overflow-hidden shadow-sm p-6 space-y-4">
        <div>
          <h3 class="text-brand-sage font-bold flex items-center mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {$t.support.households_title}
          </h3>
          <p class="text-sm text-gray-600 leading-relaxed mb-2">{$t.support.households_desc}</p>
          <p class="text-sm text-gray-600 leading-relaxed">{$t.support.households_roles}</p>
        </div>

        <hr class="border-gray-100" />

        <div>
           <h3 class="text-brand-sage font-bold flex items-center mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {$t.support.pets_schedules_title}
          </h3>
          <p class="text-sm text-gray-600 leading-relaxed">{$t.support.pets_schedules_desc}</p>
        </div>

        <hr class="border-gray-100" />

        <div>
           <h3 class="text-brand-sage font-bold flex items-center mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {$t.support.dashboard_logging_title}
          </h3>
          <p class="text-sm text-gray-600 leading-relaxed">{$t.support.dashboard_logging_desc}</p>
        </div>

        <hr class="border-gray-100" />

        <div>
           <h3 class="text-brand-sage font-bold flex items-center mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            {$t.support.permissions_title}
          </h3>
          <p class="text-sm text-gray-600 leading-relaxed">{$t.support.permissions_desc}</p>
        </div>
      </section>
    </div>

    <!-- Walkthroughs section -->
    <div class="space-y-4">
      <h2 class="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">{$t.support.walkthroughs_title}</h2>

      <section class="bg-white rounded-2xl overflow-hidden shadow-sm p-6 space-y-4">
        <div>
          <h3 class="text-gray-900 font-bold mb-1">{$t.support.wt_tasks_title}</h3>
          <p class="text-sm text-gray-600 leading-relaxed">{$t.support.wt_tasks_desc}</p>
        </div>

        <hr class="border-gray-100" />

        <div>
          <h3 class="text-gray-900 font-bold mb-1">{$t.support.wt_manage_title}</h3>
          <p class="text-sm text-gray-600 leading-relaxed">{$t.support.wt_manage_desc}</p>
        </div>

        <hr class="border-gray-100" />

        <div>
          <h3 class="text-gray-900 font-bold mb-1">{$t.support.wt_languages_title}</h3>
          <p class="text-sm text-gray-600 leading-relaxed">{$t.support.wt_languages_desc}</p>
        </div>

        <hr class="border-gray-100" />

        <div>
          <h3 class="text-gray-900 font-bold mb-1">{$t.support.wt_notifications_title}</h3>
          <p class="text-sm text-gray-600 leading-relaxed">{$t.support.wt_notifications_desc}</p>
        </div>

        <hr class="border-gray-100" />

        <div>
          <h3 class="text-gray-900 font-bold mb-1">{$t.support.wt_transfer_title}</h3>
          <p class="text-sm text-gray-600 leading-relaxed">{$t.support.wt_transfer_desc}</p>
        </div>

        <hr class="border-gray-100" />

        <div>
          <h3 class="text-gray-900 font-bold mb-1">{$t.support.wt_reports_title}</h3>
          <p class="text-sm text-gray-600 leading-relaxed">{$t.support.wt_reports_desc}</p>
        </div>
      </section>
    </div>

    <!-- Free vs Premium section -->
    <div class="space-y-4">
      <h2 class="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">{$t.support.free_vs_premium_title}</h2>

      <section class="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
        <!-- Pets per Household -->
        <div class="p-4">
          <h3 class="font-bold text-gray-900 mb-3">{$t.support.table_pets}</h3>
          <div class="grid grid-cols-2 gap-3">
            <div class="bg-gray-50 rounded-lg p-3 text-center">
              <div class="text-xs text-gray-500 mb-1">{$t.support.table_free}</div>
              <div class="text-lg font-bold text-gray-900">2</div>
            </div>
            <div class="bg-brand-sage/10 rounded-lg p-3 text-center">
              <div class="text-xs text-brand-sage/70 mb-1">{$t.support.table_premium}</div>
              <div class="text-lg font-bold text-brand-sage">{$t.support.table_unlimited}</div>
            </div>
          </div>
        </div>

        <!-- Owned Households -->
        <div class="p-4">
          <h3 class="font-bold text-gray-900 mb-3">{$t.support.table_households}</h3>
          <div class="grid grid-cols-2 gap-3">
            <div class="bg-gray-50 rounded-lg p-3 text-center">
              <div class="text-xs text-gray-500 mb-1">{$t.support.table_free}</div>
              <div class="text-lg font-bold text-gray-900">1</div>
            </div>
            <div class="bg-brand-sage/10 rounded-lg p-3 text-center">
              <div class="text-xs text-brand-sage/70 mb-1">{$t.support.table_premium}</div>
              <div class="text-lg font-bold text-brand-sage">{$t.support.table_unlimited}</div>
            </div>
          </div>
        </div>

        <!-- Households Members -->
        <div class="p-4">
          <h3 class="font-bold text-gray-900 mb-3">{$t.support.households_title} ({$t.settings.members})</h3>
          <div class="grid grid-cols-2 gap-3">
            <div class="bg-gray-50 rounded-lg p-3 text-center">
              <div class="text-xs text-gray-500 mb-1">{$t.support.table_free}</div>
              <div class="text-sm font-bold text-gray-900">{$t.support.table_unlimited}</div>
            </div>
            <div class="bg-brand-sage/10 rounded-lg p-3 text-center">
              <div class="text-xs text-brand-sage/70 mb-1">{$t.support.table_premium}</div>
              <div class="text-sm font-bold text-brand-sage">{$t.support.table_unlimited}</div>
            </div>
          </div>
        </div>

        <!-- Pet Avatars -->
        <div class="p-4">
          <h3 class="font-bold text-gray-900 mb-3">{$t.support.table_avatars}</h3>
          <div class="grid grid-cols-2 gap-3">
            <div class="bg-gray-50 rounded-lg p-3 text-center">
              <div class="text-xs text-gray-500 mb-1">{$t.support.table_free}</div>
              <div class="text-xs font-semibold text-gray-900">{$t.support.table_avatars_free}</div>
            </div>
            <div class="bg-brand-sage/10 rounded-lg p-3 text-center">
              <div class="text-xs text-brand-sage/70 mb-1">{$t.support.table_premium}</div>
              <div class="text-xs font-semibold text-brand-sage">{$t.support.table_avatars_premium}</div>
            </div>
          </div>
        </div>

        <!-- Activity History -->
        <div class="p-4">
          <h3 class="font-bold text-gray-900 mb-3">{$t.support.table_history}</h3>
          <div class="grid grid-cols-2 gap-3">
            <div class="bg-gray-50 rounded-lg p-3 text-center">
              <div class="text-xs text-gray-500 mb-1">{$t.support.table_free}</div>
              <div class="text-xs font-semibold text-gray-900">{$t.support.table_history_free}</div>
            </div>
            <div class="bg-brand-sage/10 rounded-lg p-3 text-center">
              <div class="text-xs text-brand-sage/70 mb-1">{$t.support.table_premium}</div>
              <div class="text-xs font-semibold text-brand-sage">{$t.support.table_history_premium}</div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Contact Support section -->
    <div class="space-y-4">
      <h2 class="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">{$t.support.contact_title}</h2>
      
      <section class="bg-white rounded-2xl overflow-hidden shadow-sm p-6 text-center">
         <p class="text-sm text-gray-600 mb-6">{$t.support.contact_desc}</p>
         
         <a 
            href="mailto:{$t.support.support_email}" 
            class="inline-block w-full py-4 text-white font-bold text-sm bg-brand-sage hover:bg-brand-sage/90 rounded-2xl shadow-lg shadow-brand-sage/20 transition-colors mb-4"
         >
            {$t.support.contact_button}
         </a>
         
         <p class="text-xs text-gray-400 italic">{$t.support.contact_note}</p>
      </section>
    </div>

  </main>
</div>
