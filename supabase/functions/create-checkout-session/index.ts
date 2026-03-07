import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Get Stripe secret key from environment
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
        if (!stripeKey) {
            throw new Error('STRIPE_SECRET_KEY not configured');
        }

        const stripe = new Stripe(stripeKey, {
            apiVersion: '2023-10-16',
            httpClient: Stripe.createFetchHttpClient(),
        });

        // Create Supabase client from request (handles auth automatically)
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'https://ryrwlkbzyldzbscvcqjh.supabase.co';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

        if (!supabaseAnonKey) {
            throw new Error('SUPABASE_ANON_KEY not configured');
        }

        // Create client from request headers (automatically extracts and validates JWT)
        const authHeader = req.headers.get('Authorization')!;
        const token = authHeader.replace('Bearer ', '');

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        });

        // Get authenticated user
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (userError || !user) {
            console.error('Auth error:', userError);
            throw new Error('Not authenticated: ' + (userError?.message || 'Invalid token'));
        }

        // Get user's email from profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('email, first_name')
            .eq('id', user.id)
            .single();

        // Parse request body
        const { priceId, mode = 'subscription' } = await req.json();

        if (!priceId) {
            throw new Error('priceId is required');
        }

        const appUrl = Deno.env.get('APP_URL') || 'https://whofed.me';

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            customer_email: profile?.email || user.email,
            client_reference_id: user.id, // Store user ID for webhook
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: mode, // 'subscription' or 'payment' (for one-time)
            success_url: `${appUrl}/premium/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${appUrl}/settings?canceled=true`,
            metadata: {
                user_id: user.id,
                user_email: profile?.email || user.email || '',
            },
            subscription_data: mode === 'subscription' ? {
                metadata: {
                    user_id: user.id,
                },
            } : undefined,
            allow_promotion_codes: true, // Allow discount codes
        });

        return new Response(JSON.stringify({
            sessionId: session.id,
            url: session.url
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error('Checkout session error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
