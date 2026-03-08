<script lang="ts">
    import { onMount } from 'svelte';
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
    let prices: any = null;
    let monthlyPrice = '';
    let annualPrice = '';

    onMount(async () => {
        if (isWeb) {
            // Fetch Stripe prices
            prices = await stripeService.fetchPrices();
            if (prices) {
                const monthly = prices.find((p: any) => p.interval === 'month');
                const annual = prices.find((p: any) => p.interval === 'year');

                if (monthly) monthlyPrice = stripeService.formatPrice(monthly.amount, monthly.currency);
                if (annual) annualPrice = stripeService.formatPrice(annual.amount, annual.currency);
            }
        } else {
            // Use RevenueCat prices for mobile
            const packages = $currentOfferings;
            const monthly = packages.find(p => p.identifier.includes('monthly'));
            const annual = packages.find(p => p.identifier.includes('annual'));

            if (monthly) monthlyPrice = monthly.product.priceString;
            if (annual) annualPrice = annual.product.priceString;
        }
    });

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
        <div class="bg-gradient-to-br from-brand-sage to-brand-sage/80 p-8 text-center text-white relative overflow-hidden">
            <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <div class="relative z-10">
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
                    class="flex-1 py-3 px-4 rounded-xl font-semibold transition-all {selectedInterval === 'monthly' ? 'bg-brand-sage text-white' : 'bg-gray-100 text-gray-600'}"
                    on:click={() => selectedInterval = 'monthly'}
                    disabled={loading}
                >
                    <div class="flex flex-col items-center">
                        <span>Monthly</span>
                        {#if monthlyPrice}
                            <span class="text-xs opacity-70 mt-0.5">{monthlyPrice}/mo</span>
                        {/if}
                    </div>
                </button>
                <button
                    type="button"
                    class="flex-1 py-3 px-4 rounded-xl font-semibold transition-all {selectedInterval === 'annual' ? 'bg-brand-sage text-white' : 'bg-gray-100 text-gray-600'}"
                    on:click={() => selectedInterval = 'annual'}
                    disabled={loading}
                >
                    <div class="flex flex-col items-center">
                        <span>Annual</span>
                        {#if annualPrice}
                            <span class="text-xs opacity-70 mt-0.5">{annualPrice}/yr</span>
                        {:else}
                            <span class="text-xs opacity-70">Save 20%</span>
                        {/if}
                    </div>
                </button>
            </div>

            <!-- USD Note -->
            <p class="text-xs text-gray-400 text-center mb-4">Prices in USD</p>

            <button
                class="w-full py-4 bg-brand-sage text-white font-bold rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
