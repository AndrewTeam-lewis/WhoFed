# Portuguese Language Support Audit

**Date**: 2026-03-07

This document catalogs every place in the WhoFed codebase where Portuguese translation is missing or incomplete. Use this as a checklist when working on localization.

---

## Status Summary

| Area | Status |
|------|--------|
| i18n key files (`en.ts` / `pt.ts`) | Complete — all 284 keys match, all placeholders consistent |
| Push notification templates (Postgres) | Complete — `notification_templates` table has EN + PT |
| Invite email (edge function) | English only |
| Forgot Password email (Supabase Auth) | Complete — dual-language template applied |
| Client-side components | Mixed — many hardcoded English strings |

---

## Tier 1: User-Facing Emails & Notifications

### 1.1 Invite Email — `supabase/functions/send-invite-email/index.ts`

**Status**: English only. No `language` parameter accepted.

| Line | String |
|------|--------|
| 30 | Subject: `"{inviter_name} invited you to {household_name} on WhoFed"` |
| 34 | Button: `"Create Account & Join"` (new user) |
| 36 | Button: `"Accept Invitation"` (existing user) |
| 45 | Subtitle: `"Pet Care Coordination"` |
| 50 | Heading: `"You've Been Invited!"` |
| 53 | Body: `"Create your account to get started!"` / `"Accept your invitation to start coordinating pet care together!"` |
| 65 | Fallback: `"Button not working?"` |
| 66 | Fallback: `"Copy and paste this link into your browser:"` |
| 71 | Tip: `"Accept this invitation in the mobile app to get push notifications..."` |
| 77 | Disclaimer: `"If you weren't expecting this invitation, you can safely ignore this email."` |
| 84 | Footer: `"© 2025 WhoFed. All rights reserved."` |
| 91 | Plain text version (same strings) |

**Fix**: Add `language` param from client, use inline i18n dictionary (like `send-push` does).

### 1.2 Forgot Password Email — Supabase Dashboard

**Status**: Complete — Dual-language template (EN + PT) applied in Supabase Dashboard → Authentication → Email Templates → Reset Password.

### 1.3 FCM Fallbacks — `supabase/functions/send-push/index.ts`

**Status**: The i18n dictionary (lines 19-42) is bilingual, but `sendFCM()` has English-only fallbacks.

| Line | String |
|------|--------|
| 255 | Fallback title: `"WhoFed Reminder"` |
| 256 | Fallback body: `"Time to feed the pets!"` |

**Fix**: These should rarely trigger (title/body are always built upstream), but could pass language through to make them safe.

---

## Tier 2: Entire Pages with ZERO i18n

These files have no `$t` usage at all — every string is hardcoded English.

### 2.1 Join Page — `src/routes/join/+page.svelte`

| Line | String |
|------|--------|
| 75 | `"Invalid or expired invite link."` |
| 87 | `"Household not found (invalid ID)"` |
| 131 | `"Failed to join household"` |
| 159 | `"Loading invite..."` |
| 169 | `"Oops!"` |
| 171 | `"Go Home"` |
| 182 | `"Download WhoFed"` |
| 183-184 | `"You've been invited to help care for pets on WhoFed."` |
| 200 | `"Download on App Store"` |
| 212 | `"Get it on Google Play"` |
| 217 | `"Or continue on web"` |
| 223 | `"Create Web Account"` |
| 230 | `"Log In on Web"` |
| 250 | `"Join Household?"` |
| 251-254 | Invite details with hardcoded `"member"/"members"` |
| 265 | `"Join Now"` |
| 268 | `"Cancel"` |

### 2.2 Profile Page — `src/routes/profile/+page.svelte`

| Line | String |
|------|--------|
| 69 | `"Profile updated successfully!"` |
| 86 | `"Profile"` |
| 100 | `"Email"` |
| 105 | `"Username"` |
| 110 | `"First Name"` |
| 115 | `"Auth Provider"` |
| 125 | `"Edit Profile"` |
| 132 | `"Logout"` |
| 164 | `"Save Changes"` |
| 172 | `"Cancel"` |
| 178 | `"Loading profile..."` |

### 2.3 Landing Page — `src/lib/components/LandingPage.svelte`

| Line | String |
|------|--------|
| 14 | `"Pet Care Simplified"` |
| 19 | `"Connect with your family to track feedings, medicine and more..."` |
| 26 | `"Log In"` |
| 30 | `"New here?"` |
| 31 | `"Create an account"` |
| 39 | `"Privacy Policy"` |
| 41 | `"Terms of Service"` |

### 2.4 Walkthrough — `src/lib/components/Walkthrough.svelte`

| Line | String |
|------|--------|
| 16-27 | All carousel slides: `"Welcome to WhoFed!"`, `"No More Double-Feeding"`, `"Let's Get Started"` |
| 77 | `"Start Tracking"` / `"Next"` |
| 108 | `"Invite Family"` |
| 110 | `"Tap the + button to generate an invite link..."` |
| 112 | `"Close"` |
| 125 | `"How Shared Homes Work"` |
| 129 | `"Got it"` |
| 142 | `"One-Time vs Recurring"` |
| 146 | `"Thanks"` |

### 2.5 Premium Success — `src/routes/premium/success/+page.svelte`

| Line | String |
|------|--------|
| 44-45 | `"Welcome to Premium!"` |
| 48-49 | `"You now have unlimited access to all WhoFed features."` |
| 59-77 | Feature list: `"Unlimited pets"`, `"Custom pet photos"`, `"Multiple households"`, `"PDF exports"` |
| 84 | `"Redirecting to settings in {countdown} second(s)..."` |
| 91 | `"Go Now"` |

### 2.6 Notification Prompt — `src/lib/components/NotificationPrompt.svelte`

| Line | String |
|------|--------|
| 37 | `"Never Miss a Feeding!"` |
| 38 | `"Get notified when it's time to feed, give meds, or care for your pets."` |
| 53/56 | `"Enabling..."` / `"Enable Notifications"` |
| 64 | `"Maybe Later"` |
| 69 | `"You can change this anytime in Settings"` |

### 2.7 Change Email Modal — `src/lib/components/ChangeEmailModal.svelte`

| Line | String |
|------|--------|
| 16-23 | Validation: `"Please enter a new email address"`, `"New email must be different"`, `"Please enter a valid email address"` |
| 58 | `"Change Email"` |
| 74-76 | `"Check Your Inbox"`, `"We have sent a confirmation link to..."` |
| 88-89 | `"Changing your email address requires verification..."` |
| 93/103 | `"Current Email"` / `"New Email"` |
| 124/126 | `"Sending..."` / `"Send Confirmation Link"` |

### 2.8 Photo Modals — `src/lib/components/PhotoSourceModal.svelte`, `PhotoCropModal.svelte`

**PhotoSourceModal:**
| Line | String |
|------|--------|
| 22 | `"Camera or photo access denied. Please enable in Settings."` |
| 128 | `"Add Pet Photo"` |
| 148 | `"Take Photo"` |
| 161 | `"Choose from Library"` |
| 171 | `"Cancel"` |

**PhotoCropModal:**
| Line | String |
|------|--------|
| 77 | `"Image too large (>10MB). Please choose a smaller image."` |
| 181 | `"Crop & Zoom Photo"` |
| 205 | `"Rotate"` |
| 217/233 | `"Cancel"` / `"Save"` |
| 240 | `"Pinch to zoom - Drag to reposition"` |

### 2.9 App Banner — `src/lib/components/AppBanner.svelte`

| Line | String |
|------|--------|
| 62 | `"Open in WhoFed App"` |
| 63 | `"For the best experience"` |
| 71 | `"Open App"` |

### 2.10 Date/Time Pickers — `DatePicker.svelte`, `TimePicker.svelte`

**DatePicker:**
| Line | String |
|------|--------|
| 6 | `"Select Date"` |
| 105 | Day abbreviations: `['S', 'M', 'T', 'W', 'T', 'F', 'S']` |
| 142 | `"Cancel"` |

**TimePicker:**
| Line | String |
|------|--------|
| 124/131 | `"AM"` / `"PM"` (Note: PT uses 24-hour time) |
| 142/148 | `"Cancel"` / `"Set Time"` |

### 2.11 Selection Modal — `src/lib/components/SelectionModal.svelte`

| Line | String |
|------|--------|
| 6 | `"Select Option"` |
| 42 | `"No items found."` |

---

## Tier 3: Partial i18n (Mix of `$t` and Hardcoded)

These files USE `$t` for some strings but have hardcoded English elsewhere.

### 3.1 Dashboard — `src/routes/app/+page.svelte` (~30 hardcoded strings)

Key gaps:
- Delete pet/task confirmation modals (headings, body, buttons)
- One-time task modal (labels, buttons)
- Create household modal (placeholder, timezone fallback)
- `alert()` calls for errors
- `"Tap to view and accept"` invite banner text
- `"No pets have been added..."` empty state
- `toLocaleDateString('en-US', ...)` hardcoded locale
- Premium feature modal props (`featureName`, `featureDescription`)
- `'Owner'` / `'Member'` badges

### 3.2 Settings — `src/routes/settings/+page.svelte` (~60 hardcoded strings)

Key gaps:
- All confirmation/delete modals (remove member, leave household, delete household, delete account)
- Premium section (`"WhoFed Premium"`, `"Upgrade"`, `"Active"`, feature descriptions)
- Admin tools section (`"Toggle Premium Status"`, `"Test Notification"`)
- Edit pet modal (labels, buttons)
- `"Push notifications work best on the mobile app..."` text
- `"Mobile"` section header
- `invite.status` displayed raw (`pending`/`accepted`/`declined`)
- `' (You)'` appended to member name
- ~20 `alert()` calls with English error messages

### 3.3 Add Pet — `src/routes/pets/add/+page.svelte`

Key gaps:
- `DAYS_OF_WEEK` array: `['M', 'T', 'W', 'T', 'F', 'S', 'S']`
- Validation alerts (`"Please enter a valid pet name."`, `"Please select at least one day..."`)
- `"Uploading..."` button text
- `"Please provide a name for this task"` validation
- Premium feature modal props

### 3.4 Pet Settings — `src/routes/pets/[id]/settings/+page.svelte`

Key gaps:
- Same `DAYS_OF_WEEK` array
- Photo buttons: `"Processing..."`, `"Add Photo"`, `"Edit Photo"`, `"Remove Photo"`
- `"Delete this whole group?"` confirm
- Premium feature modal props
- Validation alerts

### 3.5 Pet History — `src/routes/pets/[id]/history/+page.svelte`

Key gaps:
- Task type fallbacks: `"Feeding"`, `"Medication"`, `"Care"`
- Empty state: `"No activity yet"`, `"Activity will appear here..."`
- Premium feature modal props

### 3.6 Auth Pages

**Login** (`src/routes/auth/login/+page.svelte`):
- `"Forgot password?"` link text
- `"Login failed"` / `"Google sign-in failed"` fallbacks
- `"Terms of Service"` / `"Privacy Policy"` fallbacks

**Register** (`src/routes/auth/register/+page.svelte`):
- `"Registration successful! Redirecting..."` success message
- `"Registration failed"` / `"Google sign-in failed"` fallbacks

**Forgot Password** (`src/routes/auth/forgot-password/+page.svelte`):
- `"Failed to send reset email"` fallback

**Reset Password** (`src/routes/auth/reset-password/+page.svelte`):
- `"Reset Password in App"`, `"For the best experience, open this page in the WhoFed app."`, `"Open in WhoFed App"`

**Confirm** (`src/routes/auth/confirm/+page.svelte`):
- `"Email confirmed! Please log in."`, `"Verifying your change..."`

**Callback** (`src/routes/auth/callback/+page.svelte`):
- `"Completing sign in..."`

### 3.7 Other Components

**PremiumFeatureModal.svelte**: `"WhoFed Premium"`, `"Monthly"`, `"Annual"`, `"Prices in USD"`, `"Upgrade Now"`, `"Maybe Later"`

**NotificationsModal.svelte**: `"Someone"`, `"Unnamed Household"` fallbacks, alert error messages

**InviteMemberModal.svelte**: `"Email invitation sent to..."` fallback, alert error messages

**CustomTimezoneSelect.svelte**: `"Select Timezone"`, `"No timezones available."`

**HouseholdSetupModal.svelte**: `"Household Timezone"` fallback

---

## Tier 4: Service Files

### 4.1 `src/lib/services/notifications.ts`
- `"User denied push permissions"`
- `"Push notifications are not supported on this device."`
- `"Must be logged in"`
- Test notification: `"Test Notification"`, `"If you see this, Web Push is working!"`
- Alert messages: `"Push Error: ..."`, `"Push Sent! Server says: ..."`

### 4.2 `src/lib/services/stripe.ts`
- `"Not authenticated. Please log in."`
- `"No checkout URL returned"`, `"Failed to start checkout"`
- `"No portal URL returned"`, `"Failed to open customer portal"`
- `"Failed to fetch prices"`
- Hardcoded locale: `new Intl.NumberFormat('en-US', ...)`

### 4.3 `src/lib/services/purchases.ts`
- `"Purchases are only available on the mobile app."`
- `"Purchases restored!"`

### 4.4 `src/lib/services/export.ts`
- PDF column headers: `"Date"`, `"Pet"`, `"Action"`, `"Details"`, `"Performed By"` (has `$t` fallbacks but fallbacks are English)
- PDF labels: `"WhoFed Export"`, `"Generated on"`, `"Medical Records Only"`
- Action labels: `"un-fed"`, `"X MISSED MED"`, `"Medication"`

### 4.5 `src/lib/services/auth.ts`
- `"Registration failed"` fallback

### 4.6 `src/lib/services/imageUploadService.ts`
- `"Original upload failed"`, `"Thumbnail upload failed"`, `"Upload failed"`
- `"Failed to fetch original photo. It may have been uploaded before the edit feature was added."`

---

## Tier 5: Low Priority

### 5.1 Debug Page — `src/routes/debug/+page.svelte`
Developer-only tool. All English. Intentionally not localized.

### 5.2 Page `<title>` Tags
- `"Dashboard - WhoFed"`, `"Settings - WhoFed"`, `"Edit {name} - WhoFed"`, `"Join Household - WhoFed"`, `"Support - WhoFed"`, `"Welcome to Premium! - WhoFed"`

### 5.3 Layout Fallbacks — `src/routes/+layout.svelte`
- `"Unknown"` owner name fallback
- `"My Household"`, `"{ownerName}'s Household"` fallbacks

---

## Cross-Cutting Issues

### Hardcoded Locale
- `toLocaleDateString('en-US', ...)` in dashboard — should use user's locale
- `new Intl.NumberFormat('en-US', ...)` in stripe.ts — should use user's locale

### Day Abbreviations
- `['M', 'T', 'W', 'T', 'F', 'S', 'S']` appears in both `add/+page.svelte` and `pets/[id]/settings/+page.svelte`
- Portuguese would use: `['S', 'T', 'Q', 'Q', 'S', 'S', 'D']`

### AM/PM vs 24-Hour
- TimePicker shows AM/PM — Portuguese users typically use 24-hour format

### `alert()` / `confirm()` Calls
- ~45 total across the app with English text
- These are browser-native dialogs and can't be styled, but the text inside should be localized

### Invite Status Labels
- `invite.status` is displayed raw from the database (`pending`, `accepted`, `declined`)
- These should map through i18n (already have keys: `$t.invite.status_pending`, etc.)
