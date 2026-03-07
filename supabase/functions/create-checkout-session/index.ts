import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    console.log('=== CREATE CHECKOUT SESSION REQUEST ===');
    console.log('Method:', req.method);
    console.log('Headers:', Object.fromEntries(req.headers.entries()));

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        console.log('Step 1: Checking Stripe key...');
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
        if (!stripeKey) {
            throw new Error('STRIPE_SECRET_KEY not configured');
        }
        console.log('Step 1: Stripe key found ✓');

        const stripe = new Stripe(stripeKey, {
            apiVersion: '2023-10-16',
            httpClient: Stripe.createFetchHttpClient(),
        });

        console.log('Step 2: Checking auth header...');
        const authHeader = req.headers.get('Authorization');
        console.log('Auth header present:', !!authHeader);
        console.log('Auth header value:', authHeader?.substring(0, 20) + '...');

        if (!authHeader) {
            throw new Error('No authorization header');
        }

        console.log('Step 3: Setting up Supabase client...');
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'https://ryrwlkbzyldzbscvcqjh.supabase.co';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
        console.log('Supabase URL:', supabaseUrl);
        console.log('Supabase anon key present:', !!supabaseAnonKey);

        if (!supabaseAnonKey) {
            throw new Error('SUPABASE_ANON_KEY not configured');
        }

        const token = authHeader.replace('Bearer ', '');
        console.log('JWT token extracted, length:', token.length);
        console.log('JWT token prefix:', token.substring(0, 30) + '...');

        // Try to decode JWT header (base64) to see the algorithm
        try {
            const [headerB64] = token.split('.');
            const headerJson = atob(headerB64);
            const header = JSON.parse(headerJson);
            console.log('JWT header decoded:', header);
        } catch (e) {
            console.error('Failed to decode JWT header:', e);
        }

        // Check JWT-related environment variables (don't log actual values)
        console.log('Environment check:');
        console.log('  JWT_SECRET present:', !!Deno.env.get('JWT_SECRET'));
        console.log('  SUPABASE_JWT_SECRET present:', !!Deno.env.get('SUPABASE_JWT_SECRET'));
        console.log('  SUPABASE_SERVICE_ROLE_KEY present:', !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

        // Try using service role key for JWT validation (bypasses some restrictions)
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const keyToUse = serviceRoleKey || supabaseAnonKey;
        console.log('Using key type:', serviceRoleKey ? 'SERVICE_ROLE' : 'ANON');

        const supabase = createClient(supabaseUrl, keyToUse, {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        });
        console.log('Step 3: Supabase client created ✓');

        console.log('Step 4: Validating user JWT...');
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        console.log('User validation result:', {
            hasUser: !!user,
            hasError: !!userError,
            userId: user?.id,
            errorMessage: userError?.message,
            errorDetails: userError
        });

        if (userError || !user) {
            console.error('Auth error:', userError);
            throw new Error('Not authenticated: ' + (userError?.message || 'Invalid token'));
        }
        console.log('Step 4: User validated ✓ User ID:', user.id);

        console.log('Step 5: Fetching user profile...');
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('email, first_name')
            .eq('id', user.id)
            .single();

        console.log('Profile result:', {
            hasProfile: !!profile,
            email: profile?.email,
            hasError: !!profileError,
            errorMessage: profileError?.message
        });

        console.log('Step 6: Parsing request body...');
        const body = await req.json();
        console.log('Request body:', body);

        const { priceId, mode = 'subscription' } = body;

        if (!priceId) {
            throw new Error('priceId is required');
        }
        console.log('Step 6: Price ID:', priceId, 'Mode:', mode);

        const appUrl = Deno.env.get('APP_URL') || 'https://whofed.me';
        console.log('App URL:', appUrl);

        console.log('Step 7: Creating Stripe checkout session...');
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

        console.log('Step 7: Stripe session created ✓');
        console.log('Session ID:', session.id);
        console.log('Checkout URL:', session.url);

        const response = {
            sessionId: session.id,
            url: session.url
        };
        console.log('Step 8: Returning success response');
        console.log('=== REQUEST COMPLETED SUCCESSFULLY ===');

        return new Response(JSON.stringify(response), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error('=== ERROR OCCURRED ===');
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Full error:', error);
        console.error('=== END ERROR ===');

        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
