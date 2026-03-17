<script lang="ts">
    import { onMount } from 'svelte';
    import { createEventDispatcher } from 'svelte';
    import { Capacitor } from '@capacitor/core';
    import { stripeService, STRIPE_PRICES } from '$lib/services/stripe';
    import { purchasesService, currentOfferings } from '$lib/services/purchases';
    import { t } from '$lib/services/i18n';

    export let featureName: string;
    export let featureDescription: string;

    const dispatch = createEventDispatcher();

    // Platform detection
    const isNative = Capacitor.isNativePlatform();
    const isWeb = !isNative;

    let loading = false;
    let selectedInterval: 'monthly' | 'annual' = 'annual';

    // Hardcoded prices (USD) - override with RevenueCat if available on mobile
    let monthlyPrice = '$1.99';
    let annualPrice = '$19.99';

    onMount(async () => {
        if (!isWeb) {
            // Override with RevenueCat prices if available
            const packages = $currentOfferings;
            console.log('[Premium] Available packages:', packages.map(p => p.identifier));
            const monthly = packages.find(p => p.identifier.includes('monthly') || p.identifier === '$rc_monthly');
            const annual = packages.find(p => p.identifier.includes('annual') || p.identifier.includes('yearly') || p.identifier === '$rc_annual');

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
                console.log('[Premium] Looking for package. Interval:', selectedInterval, 'Available:', packages.map(p => p.identifier));
                const pkg = packages.find(p =>
                    selectedInterval === 'monthly'
                        ? (p.identifier.includes('monthly') || p.identifier === '$rc_monthly')
                        : (p.identifier.includes('annual') || p.identifier.includes('yearly') || p.identifier === '$rc_annual')
                );

                if (!pkg) {
                    throw new Error(`Package not found. Available packages: ${packages.map(p => p.identifier).join(', ') || 'none'}`);
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
                <h3 class="text-2xl font-bold">{$t.premium.title}</h3>
            </div>
        </div>
        
        <div class="p-8 text-center">
            <p class="text-gray-600 mb-6 leading-relaxed">
                {featureDescription}
                <br>
                <span class="text-sm text-gray-400 mt-2 block">{$t.premium.upgrade_unlock}</span>
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
                        <span>{$t.premium.monthly}</span>
                        <span class="text-xs opacity-70 mt-0.5">{monthlyPrice}{$t.premium.per_month}</span>
                    </div>
                </button>
                <button
                    type="button"
                    class="flex-1 py-3 px-4 rounded-xl font-semibold transition-all {selectedInterval === 'annual' ? 'bg-brand-sage text-white' : 'bg-gray-100 text-gray-600'}"
                    on:click={() => selectedInterval = 'annual'}
                    disabled={loading}
                >
                    <div class="flex flex-col items-center">
                        <span>{$t.premium.annual}</span>
                        <span class="text-xs opacity-70 mt-0.5">{annualPrice}{$t.premium.per_year}</span>
                    </div>
                </button>
            </div>

            <!-- USD Note -->
            <p class="text-xs text-gray-400 text-center mb-4">{$t.premium.prices_note}</p>

            <button
                class="w-full py-4 bg-brand-sage text-white font-bold rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                on:click={handleUpgrade}
                disabled={loading}
            >
                {loading ? $t.common.loading : $t.premium.upgrade_now}
            </button>

            <button
                class="mt-4 text-sm font-semibold text-gray-400 hover:text-gray-600"
                on:click={() => dispatch('close')}
                disabled={loading}
            >
                {$t.premium.maybe_later}
            </button>
        </div>
    </div>
</div>
