<script lang="ts">
  export let icon: string;
  export let size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  export let extraClasses = '';

  const isImage = icon && (icon.startsWith('http') || icon.startsWith('data:') || icon.endsWith('.svg') || icon.startsWith('/'));

  const sizeClasses = {
      sm: 'text-xl w-8 h-8',
      md: 'text-3xl w-12 h-12',
      lg: 'text-6xl w-32 h-32',
      xl: 'text-8xl w-40 h-40'
  };
</script>

<div class="flex items-center justify-center rounded-full overflow-hidden bg-gray-100 {sizeClasses[size]} {extraClasses} flex-shrink-0 relative">
  {#if isImage}
      <img src={icon} alt="Pet Icon" class="w-full h-full object-cover" />
  {:else}
      <span class="leading-none flex items-center justify-center h-full pb-1">{icon || '🐾'}</span>
  {/if}
</div>
