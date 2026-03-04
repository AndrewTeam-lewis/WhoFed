import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
        const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

        if (!stripeKey || !webhookSecret) {
            throw new Error('Stripe keys not configured');
        }

        const stripe = new Stripe(stripeKey, {
            apiVersion: '2023-10-16',
            httpClient: Stripe.createFetchHttpClient(),
        });

        // Verify webhook signature
        const signature = req.headers.get('stripe-signature');
        if (!signature) {
            throw new Error('No signature');
        }

        const body = await req.text();
        const event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            webhookSecret,
            undefined,
            Stripe.createSubtleCryptoProvider()
        );

        console.log('Stripe Webhook:', event.type);

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Handle different event types
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const userId = session.client_reference_id || session.metadata?.user_id;

                if (!userId) {
                    console.error('No user_id found in checkout session');
                    break;
                }

                console.log(`Granting premium to user: ${userId}`);

                const { error } = await supabase
                    .from('profiles')
                    .update({
                        tier: 'premium',
                        stripe_customer_id: session.customer as string,
                    })
                    .eq('id', userId);

                if (error) {
                    console.error('Failed to update tier:', error);
                    throw error;
                }

                console.log(`✓ Premium granted to user: ${userId}`);
                break;
            }

            case 'customer.subscription.updated':
            case 'customer.subscription.created': {
                const subscription = event.data.object as Stripe.Subscription;
                const userId = subscription.metadata.user_id;

                if (!userId) {
                    console.error('No user_id in subscription metadata');
                    break;
                }

                // Check if subscription is active
                const isActive = subscription.status === 'active' || subscription.status === 'trialing';

                console.log(`Subscription ${subscription.id} for user ${userId}: ${subscription.status}`);

                const { error } = await supabase
                    .from('profiles')
                    .update({
                        tier: isActive ? 'premium' : 'free',
                        stripe_customer_id: subscription.customer as string,
                        stripe_subscription_id: subscription.id,
                    })
                    .eq('id', userId);

                if (error) {
                    console.error('Failed to update subscription status:', error);
                    throw error;
                }

                console.log(`✓ Subscription status updated for user: ${userId}`);
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const userId = subscription.metadata.user_id;

                if (!userId) {
                    console.error('No user_id in subscription metadata');
                    break;
                }

                console.log(`Revoking premium from user: ${userId}`);

                const { error } = await supabase
                    .from('profiles')
                    .update({ tier: 'free' })
                    .eq('id', userId);

                if (error) {
                    console.error('Failed to revoke premium:', error);
                    throw error;
                }

                console.log(`✓ Premium revoked from user: ${userId}`);
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                const subscription = invoice.subscription;

                if (subscription && typeof subscription === 'string') {
                    // Fetch subscription to get user_id
                    const sub = await stripe.subscriptions.retrieve(subscription);
                    const userId = sub.metadata.user_id;

                    if (userId) {
                        console.log(`Payment failed for user: ${userId}`);

                        // Optionally revoke premium immediately or wait for retry
                        // For now, we'll let Stripe's retry logic handle it
                    }
                }
                break;
            }

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error('Webhook error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
