import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, inviter_name, household_name, is_new_user, invite_key, language } = await req.json();

    if (!email || !inviter_name || !invite_key) {
      throw new Error('Missing required parameters: email, inviter_name, invite_key');
    }

    const lang = language === 'pt' ? 'pt' : 'en';
    const i18n = {
      en: {
        subtitle: 'Pet Care Coordination',
        heading: "You've Been Invited!",
        body_new_user: 'Create your account to get started!',
        body_existing_user: 'Accept your invitation to start coordinating pet care together!',
        button_new_user: 'Create Account & Join',
        button_existing_user: 'Accept Invitation',
        button_not_working: 'Button not working?',
        copy_link: 'Copy and paste this link into your browser:',
        tip: 'Accept this invitation in the mobile app to get push notifications when it\'s time to feed or care for your pets!',
        disclaimer: 'If you weren\'t expecting this invitation, you can safely ignore this email.',
        subject_invited: 'invited you to',
        subject_fallback: 'their household',
        subject_suffix: 'on WhoFed',
        tip_label: 'Tip:',
        plain_text_tip: 'Tip: Accept in the app to get push notifications!',
      },
      pt: {
        subtitle: 'Coordenação de Cuidados com Pets',
        heading: 'Você Foi Convidado!',
        body_new_user: 'Crie sua conta para começar!',
        body_existing_user: 'Aceite seu convite para começar a coordenar os cuidados com os pets!',
        button_new_user: 'Criar Conta e Entrar',
        button_existing_user: 'Aceitar Convite',
        button_not_working: 'Botão não funciona?',
        copy_link: 'Copie e cole este link no seu navegador:',
        tip: 'Aceite este convite no aplicativo para receber notificações quando for hora de alimentar ou cuidar dos seus pets!',
        disclaimer: 'Se você não esperava este convite, pode ignorar este e-mail com segurança.',
        subject_invited: 'convidou você para',
        subject_fallback: 'o lar dele(a)',
        subject_suffix: 'no WhoFed',
        tip_label: 'Dica:',
        plain_text_tip: 'Dica: Aceite no aplicativo para receber notificações!',
      }
    };
    const dict = i18n[lang];

    const appUrl = 'https://whofed.me';

    // Send ALL invites via Resend (better deliverability with custom domain)
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    // Build email content (works for both new and existing users)
    const subject = `${inviter_name} ${dict.subject_invited} ${household_name || dict.subject_fallback} ${dict.subject_suffix}`;
    // Include email in URL for new users so registration form can pre-fill it
    const webLink = `${appUrl}/join/?k=${invite_key}&email=${encodeURIComponent(email)}`;

    const callToAction = is_new_user
      ? dict.button_new_user
      : dict.button_existing_user;

    // Use branded template
    const htmlContent = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">

  <!-- Header -->
  <div style="background: linear-gradient(135deg, #3ecf8e 0%, #2fb87a 100%); padding: 32px 24px; text-align: center;">
    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; letter-spacing: 0.5px;">WhoFed</h1>
    <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 13px;">${dict.subtitle}</p>
  </div>

  <!-- Content -->
  <div style="padding: 40px 32px;">
    <h2 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 20px; font-weight: 600;">${dict.heading}</h2>

    <p style="margin: 0 0 24px 0; color: #4a5568; font-size: 15px; line-height: 1.5;">
      <strong>${inviter_name}</strong> ${dict.subject_invited} <strong>${household_name || dict.subject_fallback}</strong> ${dict.subject_suffix}. ${is_new_user ? dict.body_new_user : dict.body_existing_user}
    </p>

    <!-- Button -->
    <div style="margin: 32px 0; text-align: center;">
      <a href="${webLink}"
         style="display: inline-block; background-color: #3ecf8e; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">
        ${callToAction}
      </a>
    </div>

    <p style="margin: 24px 0; padding: 16px; background-color: #f7fafc; border-left: 3px solid #3ecf8e; color: #4a5568; font-size: 13px; line-height: 1.5;">
      <strong>${dict.button_not_working}</strong><br>
      ${dict.copy_link}<br>
      <span style="color: #3ecf8e; word-break: break-all;">${webLink}</span>
    </p>

    <p style="margin: 24px 0; padding: 16px; background-color: #e6f7f1; border-radius: 6px; color: #2f855a; font-size: 14px; line-height: 1.5;">
      💡 <strong>${dict.tip_label}</strong> ${dict.tip}
    </p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">

    <p style="margin: 0 0 16px 0; color: #718096; font-size: 14px; line-height: 1.5;">
      ${dict.disclaimer}
    </p>
  </div>

  <!-- Footer -->
  <div style="background-color: #f7fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; color: #a0aec0; font-size: 12px;">
      © 2025 WhoFed. All rights reserved.
    </p>
  </div>

</div>
        `;

    const textContent = `${inviter_name} ${dict.subject_invited} ${household_name || dict.subject_fallback} ${dict.subject_suffix}.\n\n${callToAction}: ${webLink}\n\n${dict.plain_text_tip}`;

    // Send email via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'WhoFed <team@whofed.me>',
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
