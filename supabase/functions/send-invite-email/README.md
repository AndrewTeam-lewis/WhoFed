# Send Invite Email Function

Supabase Edge Function for sending household invitation emails via Resend.

## Purpose

This function sends email invitations to users when they're invited to join a household. It supports two scenarios:

1. **New Users**: Users without WhoFed accounts receive a welcome email with signup instructions
2. **Existing Users**: Users with accounts receive a notification email about the new household invitation

## Environment Variables

Required in Supabase Dashboard (Settings → Edge Functions → Secrets):

- `RESEND_API_KEY`: Your Resend API key

## Email Templates

### New User Email
- Subject: `{inviter_name} invited you to join WhoFed`
- Content: Welcome message, household info, app download links, signup link
- CTA: "Open in WhoFed App" (deep link) + "Sign up on the web" (fallback)

### Existing User Email
- Subject: `{inviter_name} invited you to {household_name}`
- Content: Invitation notification with household details
- CTA: "Open in WhoFed App" (deep link) + "Accept on the web" (fallback)
- Includes tip about accepting in app for push notifications

## Request Body

```typescript
{
  email: string;           // Recipient email address
  inviter_name: string;    // Name of person sending invite
  household_name?: string; // Name of household (optional)
  is_new_user: boolean;    // Whether recipient has WhoFed account
  invite_key: string;      // Household invite key for links
}
```

## Response

### Success (200)
```json
{
  "success": true,
  "email_id": "abc123..."  // Resend email ID for tracking
}
```

### Error (400)
```json
{
  "error": "Error message..."
}
```

## Deployment

Deploy using the Supabase CLI:

```bash
supabase functions deploy send-invite-email
```

Set the environment variable:

```bash
supabase secrets set RESEND_API_KEY=re_...
```

## Testing Locally

```bash
# Start functions locally
supabase functions serve send-invite-email --env-file .env.local

# Test with curl
curl -i --location --request POST 'http://localhost:54321/functions/v1/send-invite-email' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "email": "test@example.com",
    "inviter_name": "John Doe",
    "household_name": "Doe Family",
    "is_new_user": true,
    "invite_key": "test123"
  }'
```

## Integration

This function is called from:
- `src/lib/components/InviteMemberModal.svelte` when users invite others via email

Both new and existing users receive emails to maximize delivery (emails sent as backup alongside push notifications for existing users).

## Email Service

Uses [Resend](https://resend.com) for email delivery.

**From Address**: `WhoFed <noreply@whofed.me>`

Make sure `whofed.me` domain is verified in your Resend account.
