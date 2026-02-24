<script lang="ts">
  import { currentEnvironment, isDevelopment, isQA } from '$lib/config';
</script>

{#if isDevelopment || isQA}
  <div class="fixed top-2 right-2 z-50 pointer-events-none">
    <div class="
      px-3 py-1 rounded-full text-xs font-bold shadow-lg
      {isDevelopment ? 'bg-blue-500 text-white' : ''}
      {isQA ? 'bg-yellow-500 text-black' : ''}
    ">
      {currentEnvironment.toUpperCase()}
    </div>
  </div>
{/if}
