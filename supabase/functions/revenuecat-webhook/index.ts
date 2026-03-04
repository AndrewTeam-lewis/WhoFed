import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// RevenueCat Webhook Event Types
type WebhookEvent = {
    type: string; // INITIAL_PURCHASE, RENEWAL, CANCELLATION, etc.
    app_user_id: string; // Your user ID
    product_id: string;
    entitlement_ids: string[]; // e.g., ["premium"]
    presented_offering_id: string;
    transaction_id: string;
    original_transaction_id: string;
    purchased_at_ms: number;
    expiration_at_ms?: number;
    is_trial_period: boolean;
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Verify webhook authenticity (optional but recommended)
        const authHeader = req.headers.get('authorization');
        const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');

        if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
            console.error('Webhook: Invalid authorization');
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const event: WebhookEvent = await req.json();
        console.log('RevenueCat Webhook:', event.type, 'for user:', event.app_user_id);

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Handle different event types
        switch (event.type) {
            case 'INITIAL_PURCHASE':
            case 'RENEWAL':
            case 'UNCANCELLATION':
                // User has active premium subscription
                if (event.entitlement_ids.includes('premium')) {
                    console.log(`Granting premium to user: ${event.app_user_id}`);

                    const { error } = await supabase
                        .from('profiles')
                        .update({ tier: 'premium' })
                        .eq('id', event.app_user_id);

                    if (error) {
                        console.error('Failed to update tier:', error);
                        throw error;
                    }

                    console.log(`✓ Premium granted to user: ${event.app_user_id}`);
                }
                break;

            case 'CANCELLATION':
            case 'EXPIRATION':
            case 'BILLING_ISSUE':
                // User's subscription ended or has issues
                console.log(`Revoking premium from user: ${event.app_user_id}`);

                const { error } = await supabase
                    .from('profiles')
                    .update({ tier: 'free' })
                    .eq('id', event.app_user_id);

                if (error) {
                    console.error('Failed to revoke tier:', error);
                    throw error;
                }

                console.log(`✓ Premium revoked from user: ${event.app_user_id}`);
                break;

            case 'NON_RENEWING_PURCHASE':
                // Lifetime purchase or non-subscription
                if (event.entitlement_ids.includes('premium')) {
                    console.log(`Granting lifetime premium to user: ${event.app_user_id}`);

                    const { error } = await supabase
                        .from('profiles')
                        .update({ tier: 'premium' })
                        .eq('id', event.app_user_id);

                    if (error) {
                        console.error('Failed to grant lifetime premium:', error);
                        throw error;
                    }

                    console.log(`✓ Lifetime premium granted to user: ${event.app_user_id}`);
                }
                break;

            case 'SUBSCRIBER_ALIAS':
                // User's ID changed (rare, usually from device migration)
                console.log('SUBSCRIBER_ALIAS event received, no action needed');
                break;

            default:
                console.log(`Unhandled webhook type: ${event.type}`);
        }

        return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error("Webhook processing error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
