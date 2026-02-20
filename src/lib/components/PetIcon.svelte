<script lang="ts">
  interface Props {
    icon: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    extraClasses?: string;
  }

  let { icon, size = 'md', extraClasses = '' }: Props = $props();

  // Use $derived for reactivity in Svelte 5
  const isImage = $derived(icon && (icon.startsWith('http') || icon.startsWith('blob:') || icon.startsWith('data:') || icon.endsWith('.svg') || icon.startsWith('/')));

  const sizeClasses = {
      sm: 'text-xl w-8 h-8',
      md: 'text-3xl w-12 h-12',
      lg: 'text-6xl w-32 h-32',
      xl: 'text-8xl w-40 h-40'
  };

  let imageLoaded = $state(false);
  let imageError = $state(false);

  // Reset image state when icon changes
  $effect(() => {
    imageLoaded = false;
    imageError = false;
  });
</script>

<div class="flex items-center justify-center rounded-full overflow-hidden bg-gray-100 {sizeClasses[size]} {extraClasses} flex-shrink-0 relative">
  {#if isImage}
      {#if !imageLoaded && !imageError}
          <div class="animate-pulse bg-gray-200 w-full h-full rounded-full"></div>
      {/if}
      <img
          src={icon}
          alt="Pet Icon"
          class="w-full h-full object-cover {imageLoaded ? '' : 'hidden'}"
          on:load={() => imageLoaded = true}
          on:error={() => imageError = true}
      />
      {#if imageError}
          <span class="leading-none flex items-center justify-center h-full">🐾</span>
      {/if}
  {:else}
      <span class="leading-none flex items-center justify-center h-full">{icon || '🐾'}</span>
  {/if}
</div>
