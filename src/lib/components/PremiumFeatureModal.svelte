<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    
    export let featureName: string;
    export let featureDescription: string;
    
    const dispatch = createEventDispatcher();
</script>

<div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <!-- Backdrop -->
    <button type="button" class="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" on:click={() => dispatch('close')}></button>
    
    <!-- Modal -->
    <div class="bg-white rounded-[32px] overflow-hidden w-full max-w-sm shadow-2xl relative z-10 animate-scale-in">
        <div class="bg-gradient-to-br from-brand-sage to-emerald-600 p-8 text-center text-white relative overflow-hidden">
            <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <div class="relative z-10">
                <div class="text-4xl mb-2">💎</div>
                <h3 class="text-2xl font-bold mb-1">Premium Feature</h3>
                <p class="text-white/80 text-sm font-medium uppercase tracking-wider">{featureName}</p>
            </div>
        </div>
        
        <div class="p-8 text-center">
            <p class="text-gray-600 mb-8 leading-relaxed">
                {featureDescription}
                <br>
                <span class="text-sm text-gray-400 mt-2 block">Upgrade to unlock this and more.</span>
            </p>
            
            <button 
                class="w-full py-4 bg-gray-900 text-white font-bold rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
                on:click={() => { /* Navigate to subscription page or checkout */ dispatch('close'); }}
            >
                Upgrade Now
            </button>
            
            <button 
                class="mt-4 text-sm font-semibold text-gray-400 hover:text-gray-600"
                on:click={() => dispatch('close')}
            >
                Maybe Later
            </button>
        </div>
    </div>
</div>
