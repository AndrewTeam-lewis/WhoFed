# Email & Notification System — Technical Guide

This document describes every way WhoFed sends messages to users: emails, push notifications, and in-app notifications. It covers the full pipeline from trigger to delivery.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Invite Emails (Resend)](#2-invite-emails-resend)
3. [Push Notifications (FCM)](#3-push-notifications-fcm)
4. [Supabase Auth Emails](#4-supabase-auth-emails)
5. [In-App Notifications](#5-in-app-notifications)
6. [Localization Status](#6-localization-status)
7. [Deployment & Secrets](#7-deployment--secrets)
8. [Architecture Diagram](#8-architecture-diagram)

---

## 1. System Overview

WhoFed has **three** notification channels:

| Channel | Provider | Trigger | Language Support |
|---------|----------|---------|-----------------|
| Invite Emails | Resend API | User action (invite member) | English only |
| Push Notifications | Firebase Cloud Messaging (FCM) | Postgres CRON (every minute) | EN + PT via `notification_templates` table |
| Auth Emails | Supabase Auth (built-in) | User action (signup, password reset) | Supabase dashboard templates |

---

## 2. Invite Emails (Resend)

### What it does
Sends an HTML email when a household owner invites someone via the "By Email" tab in the Invite Member modal.

### Files involved
- **Client**: `src/lib/components/InviteMemberModal.svelte`
- **Edge Function**: `supabase/functions/send-invite-email/index.ts`
- **README**: `supabase/functions/send-invite-email/README.md`

### Flow

```
User clicks "Send Invite"
        │
        ▼
InviteMemberModal.svelte
  ├── Calls RPC: invite_user_by_identifier(identifier, household_id)
  │     Returns: { success, is_new_user, invited_user_id, email, household_name, invite_key }
  │
  ├── IF new user (no WhoFed account):
  │     └── Calls Edge Function: send-invite-email
  │           Body: { email, inviter_name, household_name, is_new_user: true, invite_key }
  │
  └── IF existing user (has WhoFed account):
        ├── Calls Edge Function: send-push (push notification)
        │     Body: { user_id, title, body, url: '/settings' }
        │
        └── Calls Edge Function: send-invite-email (backup email)
              Body: { email, inviter_name, household_name, is_new_user: false, invite_key }
              (Fetches email from profiles table, invite_key from household_keys table)
```

### Edge Function: `send-invite-email`

**Location**: `supabase/functions/send-invite-email/index.ts`

**From address**: `WhoFed <team@whofed.me>`

**Accepts**:
```typescript
{
  email: string;           // Recipient email
  inviter_name: string;    // Sender's display name
  household_name?: string; // Household being invited to
  is_new_user: boolean;    // Determines email copy
  invite_key: string;      // Used to build the join link
}
```

**How the link is built**:
```
https://whofed.me/join/?k={invite_key}&email={encoded_email}
```

**Email content** (hardcoded in function, NOT from Resend templates):
- Subject: `"{inviter_name} invited you to {household_name} on WhoFed"`
- Heading: `"You've Been Invited!"`
- Button text: `"Create Account & Join"` (new user) or `"Accept Invitation"` (existing)
- Includes fallback plain-text link
- Includes tip about accepting in the mobile app

**Delivery**: Direct `fetch()` call to `https://api.resend.com/emails` with raw HTML body. No Resend template IDs are used.

**Language**: English only. No `language` parameter is accepted or used.

### Invite Key Lifecycle
- Generated in `InviteMemberModal.svelte` on modal open
- Stored in `household_keys` table (one per household, upsert on `household_id`)
- Expires after 7 days (`expires_at` column)
- If expired, a new key is generated automatically
- Same key is used for both QR/link sharing and email invites

---

## 3. Push Notifications (FCM)

### What it does
Sends native Android push notifications for scheduled tasks (feeding, medication, care) and one-time tasks at their scheduled times.

### Files involved
- **CRON function**: `match_schedules_and_notify()` (latest in `supabase/migrations/20260308000000_update_cron_timezones.sql`)
- **Edge Function**: `supabase/functions/send-push/index.ts`
- **Client registration**: `src/lib/services/notifications.ts`
- **Token refresh**: Called from `src/routes/+layout.svelte` on app launch
- **Notification templates**: `notification_templates` table in Postgres

### Flow: Scheduled Tasks (recurring)

```
Postgres CRON (every minute)
        │
        ▼
match_schedules_and_notify()
  ├── Joins: schedules → pets → households → household_members → profiles
  ├── Filters: schedule enabled, reminder not disabled, user has push_subscription
  ├── Calculates current time in HOUSEHOLD timezone
  ├── Checks if current HH:MM matches any target_time in schedule
  │
  ├── IF match:
  │     ├── Looks up notification_templates by user's language + task key
  │     ├── Replaces {{pet_name}} and {{label}} placeholders
  │     └── Calls send-push Edge Function via pg_net HTTP POST
  │           Body: { user_id, schedule_id, title, body, url: '/dashboard' }
  │
  └── Also handles ONE-TIME TASKS (daily_tasks where schedule_id is null)
        Same flow but checks due_at within last minute window
```

### Notification Templates (Postgres table)

Stored in `notification_templates` table with columns: `language`, `key`, `title_template`, `body_template`.

**English templates**:
| Key | Title | Body |
|-----|-------|------|
| `feeeding_title` | `Reminder` | — |
| `onetime_title` | `Reminder` | — |
| `feed` | — | `Feed {{pet_name}}` |
| `medication` | — | `{{pet_name}} needs medication` |
| `litter` | — | `Change litter` |
| `care` | — | `Care task for {{pet_name}}` |
| `custom` | — | `Time for {{pet_name}}'s {{label}}` |
| `default` | — | `Task for {{pet_name}}` |

**Portuguese templates**:
| Key | Title | Body |
|-----|-------|------|
| `feeeding_title` | `Lembrete` | — |
| `onetime_title` | `Lembrete` | — |
| `feed` | — | `Alimentar {{pet_name}}` |
| `medication` | — | `{{pet_name}} precisa de remédio` |
| `litter` | — | `Trocar areia` |
| `care` | — | `Tarefa para {{pet_name}}` |
| `custom` | — | `Hora para {{label}} de {{pet_name}}` |
| `default` | — | `Tarefa para {{pet_name}}` |

### Edge Function: `send-push`

**Location**: `supabase/functions/send-push/index.ts`

**Accepts**:
```typescript
{
  user_id: string;
  title?: string;       // Pre-built title (from CRON) OR null
  body?: string;        // Pre-built body (from CRON) OR null
  url?: string;
  schedule_id?: string; // For granular reminder settings check
  // Raw fields (used when CRON sends raw data instead of pre-built text):
  language?: string;
  pet_name?: string;
  task_type?: string;
  label?: string;
  task_time_str?: string;
  is_one_time?: boolean;
}
```

**Two modes of operation**:
1. **Pre-built text** (current CRON): `title` and `body` are already constructed by the CRON function using templates. The edge function passes them through directly.
2. **Raw payload** (fallback): If `title` is null but `pet_name` is present, the edge function constructs the message using its own inline i18n dictionary (lines 19-41 of `send-push/index.ts`).

**Delivery pipeline**:
1. Check `reminder_settings` — if user disabled this specific schedule, skip
2. Fetch `push_subscription` from `profiles` table
3. If `{ type: 'android', token: '...' }` → send via FCM HTTP v1 API
4. If web push endpoint → currently disabled (web-push library causes deploy timeouts)
5. On `UNREGISTERED` FCM error → clears stale token from database

**FCM Authentication**: Manual JWT signing using Firebase service account (zero external dependencies). See `getAccessToken()` and `sendFCM()` functions.

### FCM Token Lifecycle

**Registration** (`notifications.ts → subscribeNative()`):
1. Check/request push permissions
2. Call `PushNotifications.register()`
3. Listen for `registration` event → save `{ type: 'android', token }` to `profiles.push_subscription`

**Token Refresh** (`notifications.ts → refreshTokenIfNeeded()`):
- Called on every app launch from `+layout.svelte`
- Re-registers with FCM to catch any rotated tokens
- Updates database with fresh token

**Stale Token Cleanup** (`send-push/index.ts`):
- If FCM returns `UNREGISTERED` or `NotRegistered`, the token is cleared from the database
- Prevents repeated failed delivery attempts

### Invite Push Notifications

Separate from the CRON flow. When an existing user is invited to a household:

```
InviteMemberModal.svelte
        │
        ▼
send-push Edge Function
  Body: {
    user_id: invited_user_id,
    title: "New Invitation" (localized via client-side $t),
    body: "{name} invited you to join a household!" (localized),
    url: '/settings'
  }
```

These use the client's current language for the title/body (passed as pre-built strings), not the notification_templates table.

### Test Notification

`notifications.ts → sendTestNotification()` sends a test push with hardcoded English text:
- Title: `"Test Notification"`
- Body: `"If you see this, Web Push is working!"`
- Calls send-push edge function directly using the Supabase URL and anon key from environment

---

## 4. Supabase Auth Emails

### What they are
Supabase Auth automatically sends transactional emails for:
- **Email confirmation** (on signup)
- **Password reset** (via `supabase.auth.resetPasswordForEmail()`)
- **Email change confirmation**

### Where templates live
These templates are configured in the **Supabase Dashboard** under:
`Authentication → Email Templates`

They are NOT in the codebase. The templates use Supabase's built-in email provider (or a custom SMTP if configured in the dashboard).

### How password reset works
1. User goes to `/auth/forgot-password/`
2. Enters email, clicks "Send Reset Link"
3. Client calls `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
4. Supabase sends the email using its dashboard template
5. User clicks link → redirected to `/auth/callback/` with `#type=recovery`
6. Callback page detects recovery type → redirects to `/auth/reset-password/`

### Language
Supabase Auth emails use whatever template is configured in the dashboard. There is no automatic language detection — if you want Portuguese, you'd need to configure it in the Supabase dashboard or use a custom SMTP with language-aware templates.

---

## 5. In-App Notifications

### Invite Banner (Dashboard)
- **File**: `src/routes/app/+page.svelte`
- Queries `household_invitations` table for pending invites where `invited_user_id = current_user`
- Shows a green banner: `"{n} new invite"` / `"{n} new invites"` (localized)
- Taps navigate to Settings page

### Invite Accordion (Settings)
- **File**: `src/routes/settings/+page.svelte`
- Shows expandable "Invitations" section with received and sent invites
- Received invites show Accept/Decline buttons
- Count badge shows `"{n} new invite"` / `"{n} new invites"` (localized)

---

## 6. Localization Status

| Component | English | Portuguese | How |
|-----------|---------|------------|-----|
| Push notifications (CRON) | Yes | Yes | `notification_templates` Postgres table |
| Push notifications (invite) | Yes | Yes | Client-side `$t` strings passed to edge function |
| Invite emails | Yes | **No** | Hardcoded English in `send-invite-email` edge function |
| Supabase Auth emails | Yes | **No** | Supabase Dashboard templates (English only) |
| In-app invite banners | Yes | Yes | Client-side i18n (`en.ts` / `pt.ts`) |
| Test notification | Yes | **No** | Hardcoded English in `sendTestNotification()` |

---

## 7. Deployment & Secrets

### Edge Functions

Deploy via Supabase CLI:
```bash
npx supabase functions deploy send-invite-email
npx supabase functions deploy send-push
```

### Required Secrets (Supabase Dashboard → Edge Functions → Secrets)

| Secret | Used by | Purpose |
|--------|---------|---------|
| `RESEND_API_KEY` | `send-invite-email` | Resend API authentication |
| `FIREBASE_SERVICE_ACCOUNT` | `send-push` | FCM authentication (full JSON service account) |

### Resend Configuration
- **Domain**: `whofed.me` (must be verified in Resend dashboard)
- **From address**: `WhoFed <team@whofed.me>`
- No Resend template IDs used — all HTML is inline in the edge function

### CRON Job
- Defined in Postgres via `pg_cron` extension
- Runs `match_schedules_and_notify()` every minute
- Uses `pg_net` to make HTTP POST to the `send-push` edge function
- Service role key is hardcoded in the migration (should use vault in production)

---

## 8. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (SvelteKit)                    │
│                                                             │
│  InviteMemberModal.svelte                                   │
│    ├── RPC: invite_user_by_identifier()                     │
│    ├── Edge: send-invite-email  ──→  Resend API ──→ Email   │
│    └── Edge: send-push          ──→  FCM API ──→ Android    │
│                                                             │
│  notifications.ts                                           │
│    ├── subscribeNative()  ──→  FCM token ──→ profiles DB    │
│    ├── refreshTokenIfNeeded()  (on every app launch)        │
│    └── sendTestNotification()  ──→  send-push Edge          │
│                                                             │
│  +layout.svelte                                             │
│    └── On mount: notificationService.refreshTokenIfNeeded() │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     POSTGRES (Supabase)                      │
│                                                             │
│  pg_cron (every minute)                                     │
│    └── match_schedules_and_notify()                         │
│          ├── Joins: schedules + pets + households + members  │
│          ├── Checks time match in household timezone         │
│          ├── Looks up notification_templates (EN/PT)         │
│          └── pg_net HTTP POST ──→ send-push Edge Function   │
│                                                             │
│  Tables:                                                    │
│    ├── profiles.push_subscription  (FCM token storage)      │
│    ├── profiles.language           (user language pref)      │
│    ├── notification_templates      (EN/PT push text)         │
│    ├── reminder_settings           (per-schedule toggles)    │
│    ├── household_keys              (invite keys, 7-day TTL)  │
│    └── household_invitations       (invite records)          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    EDGE FUNCTIONS (Deno)                      │
│                                                             │
│  send-invite-email                                          │
│    ├── Input: email, inviter_name, household_name,          │
│    │          is_new_user, invite_key                        │
│    ├── Builds HTML email with inline template                │
│    ├── Sends via Resend API (fetch)                         │
│    └── From: WhoFed <team@whofed.me>                        │
│                                                             │
│  send-push                                                  │
│    ├── Input: user_id, title, body, url, schedule_id        │
│    ├── Checks reminder_settings (granular opt-out)          │
│    ├── Fetches push_subscription from profiles              │
│    ├── Android: Manual JWT → FCM HTTP v1 API                │
│    ├── Web: Disabled (library causes deploy timeouts)       │
│    └── Stale token cleanup on UNREGISTERED error            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE AUTH (Built-in)                   │
│                                                             │
│  Sends automatically:                                       │
│    ├── Signup confirmation email                             │
│    ├── Password reset email                                 │
│    └── Email change confirmation                            │
│  Templates: Configured in Supabase Dashboard                │
│  Language: English only (dashboard config)                   │
└─────────────────────────────────────────────────────────────┘
```
