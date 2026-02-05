import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { user_id, title, body, url, schedule_id } = await req.json();

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Check Granular Settings (if schedule_id provided)
        if (schedule_id) {
            const { data: setting } = await supabase
                .from('reminder_settings')
                .select('is_enabled')
                .eq('user_id', user_id)
                .eq('schedule_id', schedule_id)
                .single();

            // If explicitly disabled, skip
            if (setting && setting.is_enabled === false) {
                console.log(`Skipping push for user ${user_id} schedule ${schedule_id} (Disabled)`);
                return new Response(JSON.stringify({ skipped: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                });
            }
        }

        // 2. Get subscription
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('push_subscription')
            .eq('id', user_id)
            .single();

        if (error || !profile?.push_subscription) {
            console.error("No subscription found", error);
            return new Response(JSON.stringify({ error: "No subscription" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 404
            });
        }

        // Configure Web Push
        // NOTE: Ideally VAPID_PUBLIC_KEY is also an env var, but hardcoded here for simplicity with valid pair.
        webpush.setVapidDetails(
            'mailto:admin@whofed.com',
            'BKgU7auEtbT1TI3WDNYygc2tGnOzgQ92JMAXvm4zuX7lgwibL747ltF4nifFtMpCJkqghlWVA9BoSaBLPAoUAHo',
            Deno.env.get('VAPID_PRIVATE_KEY')!
        );

        await webpush.sendNotification(
            profile.push_subscription,
            JSON.stringify({
                title: title || 'WhoFed Reminder',
                body: body || 'Time to feed the pets!',
                url: url || '/'
            })
        );

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
