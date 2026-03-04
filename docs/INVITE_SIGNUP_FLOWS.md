# WhoFed Invite & Signup Flows - Complete Reference

**Last Updated:** 2026-03-04
**Version:** 0.5.5

---

## 🎯 Overview

There are **3 main paths** for joining a household:
1. **QR Code / Share Link** (Mobile-first, web fallback)
2. **Email Invite - New User** (Uses Supabase invite system)
3. **Email Invite - Existing User** (Push + email notification)

---

## 1️⃣ QR Code / Share Link Flow

**Best for:** In-person invites, sharing via text/messaging apps

### Step-by-Step:

#### Owner Side:
1. Opens Settings → Household → "Invite Member" → **Link/QR Tab**
2. System generates household key (e.g., `abc123`)
   - Stored in `household_keys` table
   - Expires after 7 days
3. QR code displays: `https://whofed.me/join/?k=abc123`
4. Owner can:
   - Show QR code for scanning
   - Click "Share" button to send link via text/messaging

#### Guest Side (Not Logged In):
1. Scans QR or clicks link → Lands on `/join/?k=abc123`
2. **Automatic deep link attempt:** `whofed://join?k=abc123`
   - Timeout: 2.5 seconds
3. After timeout:
   - **If app opened:** ✅ User joins in app
   - **If app didn't open:** Shows download page

**Download Page UI:**
```
┌─────────────────────────────────────┐
│     Download WhoFed (Mobile App)    │
│                                     │
│  [📱 Download on App Store]         │
│  [📱 Get it on Google Play]         │
│                                     │
│  ────────────────────────────────   │
│  Or continue on web  (smaller text) │
│  [Create Web Account]  (gray button)│
│  [Log In on Web]       (text link)  │
└─────────────────────────────────────┘
```

4. If user clicks "Create Web Account":
   - Goes to `/auth/register?redirectTo=/join/?k=abc123`
   - Creates account → Redirected back to `/join/?k=abc123`
   - If profile incomplete → `/auth/complete-profile?redirectTo=/join/?k=abc123`
   - After profile completion → Back to `/join/?k=abc123`
   - Shows "Join Household?" screen → Clicks "Join Now" ✅

#### Logged-In User:
1. Clicks link → `/join/?k=abc123`
2. Immediately sees "Join Household?" screen:
```
┌─────────────────────────────────────┐
│       Join Household?               │
│                                     │
│  You've been invited to join        │
│  Sarah's household with 2 other     │
│  members.                           │
│                                     │
│  [    Join Now    ] (green button)  │
│  Cancel                             │
└─────────────────────────────────────┘
```
3. Clicks "Join Now" → ✅ Joined!

---

## 2️⃣ Email Invite - NEW User Flow

**Best for:** Inviting someone who doesn't have WhoFed yet

### Step-by-Step:

#### Owner Side:
1. Opens Settings → Household → "Invite Member" → **Email Tab**
2. Enters email: `newuser@email.com`
3. Clicks "Send Invite"
4. **Backend Process:**
   - RPC: `invite_user_by_identifier()`
   - Checks database for email
   - Email NOT found → Returns `is_new_user: true`
5. **Edge Function: `send-invite-email`**
   - Calls `supabase.auth.admin.inviteUserByEmail()`
   - Parameters:
     - Email: `newuser@email.com`
     - Redirect: `https://whofed.me/join/?k=abc123`
     - Metadata: `{ inviter_name, household_name, invite_key }`
6. UI shows success: "Email invitation sent to newuser@email.com"

#### New User Side:
1. Receives **branded Supabase email** (configured in Supabase Dashboard):
   - Template: "Invite user" email template
   - Subject: `${inviter_name} invited you to join WhoFed`
   - Contains metadata: inviter name, household name

**Email Template Structure:**
```
┌──────────────────────────────────────────┐
│   🐾 WhoFed 🐾   (green gradient header) │
│   Pet Care Coordination                  │
│                                          │
│  You've Been Invited!                    │
│                                          │
│  Sarah invited you to join The Smith     │
│  Household on WhoFed and help            │
│  coordinate pet care together!           │
│                                          │
│  [Create Account & Join] (green button)  │
│                                          │
│  Button not working? Copy this link...   │
└──────────────────────────────────────────┘
```

2. Clicks "Create Account & Join" button
3. **Supabase automatically:**
   - Creates auth user account
   - Confirms email
   - Database trigger `handle_new_user` creates profile row
   - Logs user in
   - Redirects to `{{ .ConfirmationURL }}` → `/join/?k=abc123`

4. **Profile Completion (if needed):**
   - Page checks if `first_name` exists in profile
   - If missing → Redirected to `/auth/complete-profile?redirectTo=/join/?k=abc123`
   - User enters name → Clicks "Continue"
   - Redirected back to `/join/?k=abc123`

5. Shows "Join Household?" screen
6. Clicks "Join Now"
7. **Auto-accept logic (`join_household_by_key`):**
   - Adds user to `household_members` table
   - Default permissions: `can_log: true`, `can_edit: false`
   - Auto-accepts any pending `household_invitations`
8. ✅ **Joined!** → Redirected to `/` (dashboard)

---

## 3️⃣ Email Invite - EXISTING User Flow

**Best for:** Inviting someone who already has a WhoFed account

### Step-by-Step:

#### Owner Side:
1. Opens Settings → Household → "Invite Member" → **Email Tab**
2. Enters email OR username: `@existinguser` or `existing@email.com`
3. Clicks "Send Invite"
4. **Backend Process:**
   - RPC: `invite_user_by_identifier()`
   - Checks database for email/username
   - User found → Creates record in `household_invitations` table
     - Status: `'pending'`
     - Invited by: Current user ID
     - Household: Target household ID
   - Returns `is_new_user: false` with `invited_user_id`
5. UI shows success: "Invite sent to existinguser"

#### Backend Automatically Sends TWO Notifications:

**A) Push Notification (Primary):**
- Edge Function: `send-push`
- Payload:
  - `user_id`: Invited user's ID
  - `title`: Translation string `invite.push_title`
  - `body`: `${inviter_name} invited you to join their household`
  - `url`: `/settings` (opens to notification view)

**B) Backup Email (via Resend API):**
- Edge Function: `send-invite-email` with `is_new_user: false`
- Uses branded template matching `email_template_invite.html`
- Subject: `${inviter_name} invited you to ${household_name}`

**Email Template:**
```
┌──────────────────────────────────────────┐
│   🐾 WhoFed 🐾   (green gradient header) │
│   Pet Care Coordination                  │
│                                          │
│  You've Been Invited!                    │
│                                          │
│  Sarah invited you to join The Smith     │
│  Household on WhoFed. Accept your        │
│  invitation to start coordinating pet    │
│  care together!                          │
│                                          │
│  [Accept Invitation] (green button)      │
│                                          │
│  Button not working? Copy this link...   │
│                                          │
│  💡 Tip: Accept in the mobile app to get │
│  push notifications when it's time to    │
│  feed or care for your pets!             │
└──────────────────────────────────────────┘
```

#### Existing User Side:

**Option A - Via Push Notification (Mobile):**
1. Gets push notification on phone
2. Taps notification → Opens app to `/settings`
3. Sees pending invitation in notifications section
4. Taps "Accept" → Updates `household_invitations.status` to `'accepted'`
5. Adds user to `household_members` → ✅ Joined!

**Option B - Via Email:**
1. Receives backup email
2. Clicks "Accept Invitation" button → Opens `/join/?k=abc123`
3. User is logged in (already has account)
4. Shows "Join Household?" screen
5. Clicks "Join Now"
6. `join_household_by_key` RPC:
   - Adds to `household_members`
   - Auto-accepts pending invitation in `household_invitations` table
7. ✅ Joined!

---

## 🔄 Technical Details

### Database Tables

**household_keys:**
```sql
- id (uuid)
- household_id (fk to households)
- key_value (text) -- Random generated string
- expires_at (timestamp) -- 7 days from creation
- created_at (timestamp)
```

**household_invitations:**
```sql
- id (uuid)
- household_id (fk to households)
- invited_user_id (fk to profiles)
- invited_by (fk to profiles)
- status (enum: 'pending' | 'accepted' | 'declined')
- created_at (timestamp)
```

**household_members:**
```sql
- id (uuid)
- household_id (fk to households)
- user_id (fk to profiles)
- is_active (boolean)
- can_log (boolean) -- Permission to log tasks
- can_edit (boolean) -- Permission to edit schedules
- created_at (timestamp)
```

### Key RPCs (Database Functions)

**1. `invite_user_by_identifier(p_identifier text, p_household_id uuid)`**
- Checks if identifier is email or username
- Looks up user in profiles table
- If not found AND is email:
  - Returns `is_new_user: true` with invite key
  - Client triggers Supabase invite email
- If found (existing user):
  - Creates `household_invitations` record
  - Returns `invited_user_id` for push notification
  - Client triggers both push + email

**2. `join_household_by_key(p_household_id uuid)`**
- Checks if user is already a member
- Adds user to `household_members` table
- **Auto-accepts** any pending `household_invitations`
- Default permissions: `can_log: true`, `can_edit: false`

**3. `get_household_from_key(lookup_key text)`**
- Validates household key
- Returns household info (name, owner, member count)
- Used by join page to display invitation details

### Edge Functions

**1. `send-invite-email`**
- Location: `supabase/functions/send-invite-email/index.ts`
- For NEW users:
  - Uses `supabase.auth.admin.inviteUserByEmail()`
  - Supabase sends branded email from dashboard template
  - Redirect URL: `https://whofed.me/join/?k=${invite_key}`
- For EXISTING users:
  - Uses Resend API to send backup email
  - Branded green template with WhoFed styling
  - Direct link to `/join/?k=${invite_key}`

**2. `send-push`**
- Sends push notifications to invited users
- Only for existing users (new users don't have devices registered)
- Deep links to `/settings` to view invitation

### Database Triggers

**`handle_new_user` Trigger:**
- Fires on new auth user creation
- Automatically creates profile row in `profiles` table
- Copies `first_name` from user metadata if available
- This ensures profiles exist for invited users

### Invite Key Preservation

The invite key (`?k=abc123`) is preserved through the entire flow using URL redirects:

**Registration Flow:**
```
/join/?k=abc123
  → /auth/register?redirectTo=/join/?k=abc123
  → [account created]
  → /join/?k=abc123
```

**Profile Completion Flow:**
```
/join/?k=abc123
  → /auth/complete-profile?redirectTo=/join/?k=abc123
  → [profile completed]
  → /join/?k=abc123
```

**Implementation:**
- [src/routes/join/+page.svelte](../src/routes/join/+page.svelte) lines 42-44
- [src/routes/auth/complete-profile/+page.svelte](../src/routes/auth/complete-profile/+page.svelte) lines 31-33, 53

---

## 🎨 UI/UX Design Decisions

### Mobile-First Approach ✅
- QR/Link flow **prioritizes app** via deep linking
- Deep link timeout: 2.5 seconds
- After timeout, shows prominent app download buttons
- App Store and Google Play buttons are large and colorful
- Web signup is available but intentionally secondary

### Web Fallback ✅
- Web signup is accessible but "buried" as requested
- Located under "Or continue on web" section with smaller text
- "Create Web Account" button uses gray styling (not primary color)
- Works perfectly for desktop users who want web access
- Fully functional despite being de-emphasized

### Email Templates 🎨
- **Consistent Branding:** All emails use green gradient header with 🐾 paw emojis
- **Color Scheme:** `#3ecf8e` to `#2fb87a` gradient (brand-sage green)
- **Responsive:** Works on mobile and desktop email clients
- **Accessible:** Plain text fallback included
- **Call-to-Action:** Large green buttons for primary actions

### Suggested Users Feature 👥
- For existing users inviting others
- Shows list of users from owner's other households
- Excludes current household members
- One-click to populate email field
- Makes re-inviting across households easier

---

## 🔒 Security & Privacy

### Email Validation
- Invite emails validated before sending
- Checks for valid email format: `contains @ and .`
- Username invites check for existing users only

### Invite Expiration
- Household keys expire after 7 days
- Old keys automatically invalid
- New key generated if needed

### Permission Defaults
- New members get `can_log: true` (can mark tasks complete)
- New members get `can_edit: false` (cannot modify schedules)
- Owners can adjust permissions after joining

### RLS Policies
- Users can only view invitations where they are `invited_user_id`
- Household owners can view invites for their households
- Users can only join households with valid invite keys

---

## 📊 Flow Diagrams

### QR Code Flow
```
Owner Creates Link
       ↓
   QR Code Generated (household_key)
       ↓
  Guest Scans/Clicks
       ↓
   Deep Link Attempt (2.5s)
       ↓
    ┌─────┴──────┐
    │            │
App Opens    App Failed
    │            │
Join in App  Download Page
             ↓
        Web Signup (optional)
             ↓
        Profile Complete
             ↓
        Join Household ✅
```

### New User Email Flow
```
Owner Enters Email
       ↓
Email Not Found → is_new_user: true
       ↓
supabase.auth.admin.inviteUserByEmail()
       ↓
Branded Email Sent (Supabase)
       ↓
User Clicks Confirmation Link
       ↓
Account Created + Email Confirmed
       ↓
Redirected to /join/?k=abc123
       ↓
Profile Check
       ↓
    ┌─────┴──────┐
    │            │
Complete    Already Complete
    │            │
Enter Name   Join Directly
    ↓            │
Complete ─────────┘
    ↓
Join Household ✅
```

### Existing User Email Flow
```
Owner Enters Email/Username
       ↓
User Found → is_new_user: false
       ↓
Create household_invitations Record
       ↓
   ┌──────┴──────┐
   │             │
Push Sent    Email Sent
   │         (backup)
   ↓             │
Accept in App   │
   │             │
   └──────┬──────┘
          ↓
     Join Household ✅
```

---

## 🚀 Deployment Checklist

### Supabase Configuration
- [ ] Configure "Invite user" email template in Dashboard
  - Path: Authentication → Email Templates → Invite user
  - Use branded template with WhoFed styling
  - Include metadata: `{{ .Data.inviter_name }}`, `{{ .Data.household_name }}`
  - Confirmation URL redirects to: `https://whofed.me/join/?k=...`

### Edge Functions
- [ ] Deploy `send-invite-email` function
  - `supabase functions deploy send-invite-email`
  - Ensure env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`

- [ ] Deploy `send-push` function
  - `supabase functions deploy send-push`
  - Configure push notification service (FCM/APNS)

### Database Migrations
- [ ] Ensure all invite-related migrations are applied:
  - `20260203100000_add_household_invitations.sql`
  - `20260203200000_add_invite_by_identifier.sql`
  - `20260220120000_invite_new_users_via_email.sql`
  - `20260220120001_auto_accept_pending_invites.sql`

### Environment Variables
- [ ] Production env vars set:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (Edge Functions)
  - `RESEND_API_KEY` (Edge Functions)

---

## 🐛 Troubleshooting

### Issue: User doesn't receive invite email
**Possible Causes:**
1. Email template not configured in Supabase Dashboard
2. Edge function not deployed
3. RESEND_API_KEY missing for existing users
4. Email in spam folder

**Solutions:**
- Check Supabase Dashboard → Authentication → Email Templates
- Verify Edge Function logs: `supabase functions logs send-invite-email`
- Check Resend dashboard for delivery status

### Issue: Invite key doesn't work
**Possible Causes:**
1. Key expired (7 days old)
2. Household deleted
3. Key not found in database

**Solutions:**
- Generate new invite link
- Check `household_keys` table for valid key
- Verify household still exists

### Issue: User can't join after signup
**Possible Causes:**
1. Profile not created (trigger failed)
2. Invite key lost during redirect
3. RLS policy blocking join

**Solutions:**
- Check profile exists in `profiles` table
- Verify URL contains `?k=` parameter
- Check `join_household_by_key` RPC logs

---

## 📝 Code Locations Reference

### Frontend Components
- **Invite Modal**: `src/lib/components/InviteMemberModal.svelte`
- **Join Page**: `src/routes/join/+page.svelte`
- **Complete Profile**: `src/routes/auth/complete-profile/+page.svelte`
- **Register Page**: `src/routes/auth/register/+page.svelte`

### Backend Functions
- **Invite RPC**: `supabase/migrations/20260220120000_invite_new_users_via_email.sql`
- **Join RPC**: `supabase/migrations/20260220120001_auto_accept_pending_invites.sql`
- **Invite Email Function**: `supabase/functions/send-invite-email/index.ts`
- **Push Function**: `supabase/functions/send-push/index.ts`

### Email Templates
- **Invite Template (file)**: `email_template_invite.html`
- **Supabase Template**: Configured in Supabase Dashboard

---

## ✅ Summary

**All Invite Flows Are Now:**
- ✅ **Working** - End-to-end tested and functional
- ✅ **Mobile-First** - App deep linking with web fallback
- ✅ **Branded** - Consistent green WhoFed styling
- ✅ **Seamless** - Invite keys preserved through entire flow
- ✅ **Dual-Channel** - Push + email for existing users
- ✅ **Auto-Accept** - One-click join for all scenarios
- ✅ **Secure** - RLS policies and key expiration

**Ready for production deployment!** 🚀
