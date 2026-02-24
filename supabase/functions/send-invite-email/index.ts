import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { email, inviter_name, household_name, is_new_user, invite_key } = await req.json();

        if (!email || !inviter_name || !invite_key) {
            throw new Error('Missing required parameters: email, inviter_name, invite_key');
        }

        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        if (!resendApiKey) {
            throw new Error('RESEND_API_KEY not configured');
        }

        const appUrl = 'https://whofed.me';

        // Build email content based on user type
        const subject = is_new_user
            ? `${inviter_name} invited you to join WhoFed`
            : `${inviter_name} invited you to ${household_name || 'their household'}`;

        const deepLink = `whofed://join?k=${invite_key}`;
        const webLink = `${appUrl}/join/?k=${invite_key}`;

        const htmlContent = is_new_user ? `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🐾 WhoFed</h1>
    </div>

    <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="color: #1f2937; margin-top: 0;">You've been invited!</h2>

        <p style="font-size: 16px; color: #4b5563;">
            <strong>${inviter_name}</strong> invited you to join <strong>${household_name || 'their household'}</strong> on WhoFed.
        </p>

        <p style="font-size: 16px; color: #4b5563;">
            WhoFed helps families coordinate pet care - never forget to feed, medicate, or clean up after your pets again!
        </p>

        <div style="margin: 30px 0;">
            <a href="${deepLink}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin-bottom: 12px;">
                Open in WhoFed App
            </a>
        </div>

        <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
            Don't have the app yet? <a href="${webLink}" style="color: #667eea; text-decoration: none;">Sign up on the web</a> and download it from the App Store or Google Play.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="font-size: 12px; color: #9ca3af;">
            This invitation was sent to ${email}. If you didn't expect this invitation, you can safely ignore this email.
        </p>
    </div>
</body>
</html>
        ` : `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🐾 WhoFed</h1>
    </div>

    <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="color: #1f2937; margin-top: 0;">New Household Invitation</h2>

        <p style="font-size: 16px; color: #4b5563;">
            <strong>${inviter_name}</strong> invited you to join <strong>${household_name || 'their household'}</strong>.
        </p>

        <div style="margin: 30px 0;">
            <a href="${deepLink}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin-bottom: 12px;">
                Open in WhoFed App
            </a>
        </div>

        <p style="font-size: 14px; color: #6b7280;">
            Or <a href="${webLink}" style="color: #667eea; text-decoration: none;">accept on the web</a>
        </p>

        <p style="font-size: 14px; color: #4b5563; margin-top: 30px; background: #f3f4f6; padding: 16px; border-radius: 8px; border-left: 4px solid #667eea;">
            💡 <strong>Tip:</strong> Accept this invitation in the app to get push notifications when it's time to feed or care for your pets!
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="font-size: 12px; color: #9ca3af;">
            This invitation was sent to ${email}. If you didn't expect this invitation, you can safely ignore this email.
        </p>
    </div>
</body>
</html>
        `;

        const textContent = is_new_user
            ? `${inviter_name} invited you to join ${household_name || 'their household'} on WhoFed!\n\nWhoFed helps families coordinate pet care - never forget to feed, medicate, or clean up after your pets again!\n\nJoin now: ${webLink}\n\nDon't have the app? Download it from the App Store or Google Play for push notifications.`
            : `${inviter_name} invited you to join ${household_name || 'their household'} on WhoFed.\n\nAccept the invitation: ${webLink}\n\nTip: Accept in the app to get push notifications!`;

        // Send email via Resend
        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: 'WhoFed <noreply@whofed.me>',
                to: [email],
                subject: subject,
                html: htmlContent,
                text: textContent,
            }),
        });

        if (!resendResponse.ok) {
            const errorText = await resendResponse.text();
            console.error('Resend API Error:', resendResponse.status, errorText);
            throw new Error(`Failed to send email: ${errorText}`);
        }

        const resendData = await resendResponse.json();
        console.log('Email sent successfully:', resendData);

        return new Response(JSON.stringify({ success: true, email_id: resendData.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error("Email send error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
