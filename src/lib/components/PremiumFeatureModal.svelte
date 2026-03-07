<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { Capacitor } from '@capacitor/core';
    import { stripeService, STRIPE_PRICES } from '$lib/services/stripe';
    import { purchasesService, currentOfferings } from '$lib/services/purchases';

    export let featureName: string;
    export let featureDescription: string;

    const dispatch = createEventDispatcher();

    // Platform detection
    const isNative = Capacitor.isNativePlatform();
    const isWeb = !isNative;

    let loading = false;
    let selectedInterval: 'monthly' | 'annual' = 'annual';

    async function handleUpgrade() {
        loading = true;
        try {
            if (isWeb) {
                // Web: Use Stripe
                const priceId = selectedInterval === 'monthly'
                    ? STRIPE_PRICES.monthly
                    : STRIPE_PRICES.annual;

                if (!priceId) {
                    throw new Error('Stripe price not configured');
                }

                await stripeService.createCheckoutSession(priceId);
                // User will be redirected to Stripe Checkout
            } else {
                // Mobile: Use RevenueCat
                const packages = $currentOfferings;
                const pkg = packages.find(p =>
                    selectedInterval === 'monthly'
                        ? p.identifier.includes('monthly')
                        : p.identifier.includes('annual')
                );

                if (!pkg) {
                    throw new Error('Package not found');
                }

                const success = await purchasesService.purchase(pkg);
                if (success) {
                    dispatch('close');
                }
            }
        } catch (error: any) {
            console.error('Upgrade error:', error);
            console.error('Error details:', JSON.stringify(error, null, 2));
            alert(`Error: ${error.message || 'Failed to start checkout'}\n\nCheck console for details.`);
        } finally {
            loading = false;
        }
    }
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
            <p class="text-gray-600 mb-6 leading-relaxed">
                {featureDescription}
                <br>
                <span class="text-sm text-gray-400 mt-2 block">Upgrade to unlock this and more.</span>
            </p>

            <!-- Interval Selector -->
            <div class="flex gap-2 mb-6">
                <button
                    type="button"
                    class="flex-1 py-3 px-4 rounded-xl font-semibold transition-all {selectedInterval === 'monthly' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}"
                    on:click={() => selectedInterval = 'monthly'}
                    disabled={loading}
                >
                    Monthly
                </button>
                <button
                    type="button"
                    class="flex-1 py-3 px-4 rounded-xl font-semibold transition-all {selectedInterval === 'annual' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}"
                    on:click={() => selectedInterval = 'annual'}
                    disabled={loading}
                >
                    <div class="flex flex-col items-center">
                        <span>Annual</span>
                        <span class="text-xs opacity-70">Save 20%</span>
                    </div>
                </button>
            </div>

            <button
                class="w-full py-4 bg-gray-900 text-white font-bold rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                on:click={handleUpgrade}
                disabled={loading}
            >
                {loading ? 'Loading...' : 'Upgrade Now'}
            </button>

            <button
                class="mt-4 text-sm font-semibold text-gray-400 hover:text-gray-600"
                on:click={() => dispatch('close')}
                disabled={loading}
            >
                Maybe Later
            </button>
        </div>
    </div>
</div>
