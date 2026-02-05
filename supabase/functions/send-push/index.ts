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

        const sub = profile.push_subscription;

        // 3. Determine Transport (Web vs Native)
        // Native (FCM) is stored as { type: 'android', token: '...' }
        if (sub.type === 'android' && sub.token) {
            console.log(`Sending Native FCM to user ${user_id}`);
            await sendFCM(sub.token, title, body, url);
        } else if (sub.endpoint) {
            // Web Push
            console.log(`Sending Web Push to user ${user_id}`);
            await sendWebPush(sub, title, body, url);
        } else {
            console.warn("Unknown subscription format", sub);
            // Don't fail the request, just log
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error("Handler error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});

async function sendWebPush(sub: any, title: string, body: string, url: string) {
    webpush.setVapidDetails(
        'mailto:admin@whofed.com',
        'BKgU7auEtbT1TI3WDNYygc2tGnOzgQ92JMAXvm4zuX7lgwibL747ltF4nifFtMpCJkqghlWVA9BoSaBLPAoUAHo',
        Deno.env.get('VAPID_PRIVATE_KEY')!
    );

    await webpush.sendNotification(
        sub,
        JSON.stringify({
            title: title || 'WhoFed Reminder',
            body: body || 'Time to feed the pets!',
            url: url || '/'
        })
    );
}

// Manual JWT Signer for FCM (Zero Dependencies)
async function getAccessToken(serviceAccount: any) {
    const now = Math.floor(Date.now() / 1000);
    const claim = {
        iss: serviceAccount.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: serviceAccount.token_uri,
        exp: now + 3600,
        iat: now,
    };

    const header = { alg: "RS256", typ: "JWT" };

    // PEM to Key
    const pem = serviceAccount.private_key;
    const binaryDerString = window.atob(pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s/g, ''));
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
        binaryDer[i] = binaryDerString.charCodeAt(i);
    }

    const key = await crypto.subtle.importKey(
        "pkcs8",
        binaryDer,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const sHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const sClaim = btoa(JSON.stringify(claim)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const data = new TextEncoder().encode(`${sHeader}.${sClaim}`);

    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, data);
    const sSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const jwt = `${sHeader}.${sClaim}.${sSignature}`;

    // Exchange for Access Token
    const res = await fetch(serviceAccount.token_uri, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    const json = await res.json();
    return json.access_token;
}

async function sendFCM(token: string, title: string, body: string, url: string) {
    const serviceAccountStr = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccountStr) {
        console.error("Missing FIREBASE_SERVICE_ACCOUNT env var");
        return;
    }
    const serviceAccount = JSON.parse(serviceAccountStr);

    const accessToken = await getAccessToken(serviceAccount);
    if (!accessToken) throw new Error("Failed to get access token");

    const projectId = serviceAccount.project_id;
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const payload = {
        message: {
            token: token,
            notification: {
                title: title || 'WhoFed Reminder',
                body: body || 'Time to feed the pets!',
            },
            data: {
                url: url || '/'
            }
        }
    };

    const res = await fetch(fcmEndpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const txt = await res.text();
        console.error("FCM Error:", res.status, txt);
        throw new Error(`FCM rejected: ${txt}`);
    }
}
