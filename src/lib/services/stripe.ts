import { supabase } from '$lib/supabase';
import { loadStripe } from '@stripe/stripe-js';

// Stripe publishable key (safe to expose in client)
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

// Price IDs from your Stripe Dashboard
export const STRIPE_PRICES = {
    monthly: import.meta.env.VITE_STRIPE_PRICE_MONTHLY,
    annual: import.meta.env.VITE_STRIPE_PRICE_ANNUAL,
};

export const stripeService = {
    async createCheckoutSession(priceId: string) {
        try {
            console.log('[Stripe Service] Getting session...');
            const { data: { session } } = await supabase.auth.getSession();

            console.log('[Stripe Service] Session details:', {
                hasSession: !!session,
                hasAccessToken: !!session?.access_token,
                tokenLength: session?.access_token?.length,
                tokenPreview: session?.access_token?.substring(0, 20) + '...',
                expiresAt: session?.expires_at,
                user: session?.user?.id
            });

            if (!session) {
                throw new Error('Not authenticated. Please log in.');
            }

            console.log('[Stripe Service] Invoking Edge Function with:', {
                priceId,
                mode: 'subscription',
                authHeaderPresent: !!session.access_token
            });

            // Call Edge Function directly with fetch for full control
            const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
            const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const functionUrl = `${SUPABASE_URL}/functions/v1/create-checkout-session`;

            console.log('[Stripe Service] Calling function directly:', {
                url: functionUrl,
                hasAuthToken: !!session.access_token,
                hasAnonKey: !!SUPABASE_ANON_KEY
            });

            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({
                    priceId,
                    mode: 'subscription'
                })
            });

            console.log('[Stripe Service] Response status:', response.status);
            console.log('[Stripe Service] Response ok:', response.ok);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Stripe Service] Error response:', errorText);
                throw new Error(`Edge Function error: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            console.log('[Stripe Service] Success response:', data);

            if (!data.url) {
                throw new Error('No checkout URL returned');
            }

            // Redirect to Stripe Checkout
            window.location.href = data.url;

        } catch (error: any) {
            console.error('Checkout error:', error);
            throw new Error(error.message || 'Failed to start checkout');
        }
    },

    async redirectToCustomerPortal() {
        try {
            // Call Edge Function to create customer portal session
            const { data, error } = await supabase.functions.invoke('create-portal-session', {
                body: {}
            });

            if (error) throw error;

            if (!data.url) {
                throw new Error('No portal URL returned');
            }

            // Redirect to Stripe Customer Portal
            window.location.href = data.url;

        } catch (error: any) {
            console.error('Portal error:', error);
            throw new Error(error.message || 'Failed to open customer portal');
        }
    },

    // Check if Stripe is properly configured
    isConfigured(): boolean {
        return !!(STRIPE_PUBLISHABLE_KEY && STRIPE_PRICES.monthly);
    }
};
