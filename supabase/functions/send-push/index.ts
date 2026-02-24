import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// import webpush from "npm:web-push"; // DISABLED: Causing Deploy Timeouts

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { user_id, title, body, url, schedule_id, language, pet_name, task_type, label, task_time_str, is_one_time } = await req.json();

        // Localization Dictionary
        const i18n = {
            en: {
                title_feeding: 'Feeding Time! 🐾',
                title_one_time: 'One-Time Reminder 🐾',
                title_default: 'WhoFed Reminder 🐾',
                time_to: 'Time to',
                feed: 'feed',
                give_meds: 'give medication to',
                change_litter: 'change litter for',
                do_task: 'do task for',
                its: "It's"
            },
            pt: {
                title_feeding: 'Hora de Comer! 🐾',
                title_one_time: 'Lembrete Único 🐾',
                title_default: 'Lembrete WhoFed 🐾',
                time_to: 'Hora de',
                feed: 'alimentar',
                give_meds: 'dar remédio para',
                change_litter: 'limpar a caixa de',
                do_task: 'tarefa para',
                its: "São"
            }
        };

        function formatTimeStr(timeStr: string, lang: string): string {
            if (!timeStr) return '';
            if (lang === 'pt') return timeStr; // 24-hour

            // Convert to 12-hour AM/PM for English
            const [h, m] = timeStr.split(':');
            let hour = parseInt(h, 10);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            hour = hour % 12;
            if (hour === 0) hour = 12;
            return `${hour}:${m} ${ampm}`;
        }

        let finalTitle = title;
        let finalBody = body;

        // If it's a raw Postgres Cron payload, construct the localized message
        if (!finalTitle && pet_name) {
            const lang = (language === 'pt') ? 'pt' : 'en';
            const dict = i18n[lang];
            const timeFormatted = task_time_str ? formatTimeStr(task_time_str, lang) : '';

            finalTitle = is_one_time ? dict.title_one_time : (task_type === 'feeding' ? dict.title_feeding : dict.title_default);

            let action = '';
            if (label) {
                if (lang === 'pt') action = `dar ${label} para ${pet_name}`;
                else action = `give ${label} to ${pet_name}`;
            } else if (task_type === 'medication') {
                action = `${dict.give_meds} ${pet_name}`;
            } else if (task_type === 'litter' || task_type === 'care') {
                action = `${dict.change_litter} ${pet_name}`;
            } else if (task_type === 'feeding') {
                action = `${dict.feed} ${pet_name}`;
            } else {
                action = `${dict.do_task} ${pet_name}`;
            }

            finalBody = timeFormatted ? `${dict.its} ${timeFormatted}. ${dict.time_to} ${action}` : `${dict.time_to} ${action}`;
        }

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
            // Web Push DISABLED due to deployment issues
            console.log(`Web Push skipped for user ${user_id} (Library disabled)`);
            // await sendWebPush(sub, title, body, url);
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

/*
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
*/

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
