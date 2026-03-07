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
            // Get the current session to ensure we have a valid auth token
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error('Not authenticated. Please log in.');
            }

            // Call Edge Function to create Stripe checkout session
            const { data, error } = await supabase.functions.invoke('create-checkout-session', {
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                },
                body: {
                    priceId,
                    mode: 'subscription'
                }
            });

            if (error) throw error;

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
