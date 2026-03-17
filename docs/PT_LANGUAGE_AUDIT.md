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

### ~~2.1 Join Page — `src/routes/join/+page.svelte`~~

**Status**: Complete — all display strings use `$t.join.*` keys.

### ~~2.2 Profile Page — `src/routes/profile/+page.svelte`~~

**Status**: Complete — all strings use `$t.profile.*` and `$t.common.*` keys.

### ~~2.3 Landing Page — `src/lib/components/LandingPage.svelte`~~

**Status**: Complete — all strings use `$t.landing.*` keys.

### ~~2.4 Walkthrough — `src/lib/components/Walkthrough.svelte`~~

**Status**: Complete — all strings use `$t.walkthrough.*` and `$t.common.*` keys.

### ~~2.5 Premium Success — `src/routes/premium/success/+page.svelte`~~

**Status**: Complete — all strings use `$t.premium_success.*` keys.

### ~~2.6 Notification Prompt — `src/lib/components/NotificationPrompt.svelte`~~

**Status**: Complete — all strings use `$t.notification_prompt.*` keys.

### ~~2.7 Change Email Modal — `src/lib/components/ChangeEmailModal.svelte`~~

**Status**: Complete — all strings use `$t.change_email.*` keys.

### ~~2.8 Photo Modals — `src/lib/components/PhotoSourceModal.svelte`, `PhotoCropModal.svelte`~~

**Status**: Complete — PhotoSourceModal uses `$t.photo_source.*`, PhotoCropModal uses `$t.photo_crop.*` and `$t.common.*` keys.

### ~~2.9 App Banner — `src/lib/components/AppBanner.svelte`~~

**Status**: Complete — all strings use `$t.app_banner.*` keys.

### ~~2.10 Date/Time Pickers — `DatePicker.svelte`, `TimePicker.svelte`~~

**Status**: Complete — DatePicker uses `$t.date_picker.*`, TimePicker uses `$t.time_picker.*` and `$t.common.*` keys.

### ~~2.11 Selection Modal — `src/lib/components/SelectionModal.svelte`~~

**Status**: Complete — all strings use `$t.selection_modal.*` keys.

---

## Tier 3: Partial i18n (Mix of `$t` and Hardcoded)

These files USE `$t` for some strings but have hardcoded English elsewhere.

**Re-audited 2026-03-07**: 8 of 16 files are now fully complete. ~70 hardcoded strings remain across 8 files.

### 3.1 Dashboard — `src/routes/app/+page.svelte` (~20 hardcoded strings)

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

### 3.2 Settings — `src/routes/settings/+page.svelte` (~26 hardcoded strings)

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

### 3.3 Add Pet — `src/routes/pets/add/+page.svelte` (~8 hardcoded strings)

Key gaps:
- `DAYS_OF_WEEK` array: `['M', 'T', 'W', 'T', 'F', 'S', 'S']`
- Validation alerts (`"Please enter a valid pet name."`, `"Please select at least one day..."`)
- `"Uploading..."` button text
- `"Please provide a name for this task"` validation
- Premium feature modal props

### ~~3.4 Pet Settings — `src/routes/pets/[id]/settings/+page.svelte`~~

**Status**: Complete — all strings use `$t.*` keys (re-audited 2026-03-07).

### ~~3.5 Pet History — `src/routes/pets/[id]/history/+page.svelte`~~

**Status**: Complete — all strings use `$t.*` keys (re-audited 2026-03-07).

### ~~3.6 Auth Pages~~

**Status**: All 6 auth pages are complete (re-audited 2026-03-07):
- ~~Login (`src/routes/auth/login/+page.svelte`)~~ — Complete
- ~~Register (`src/routes/auth/register/+page.svelte`)~~ — Complete
- ~~Forgot Password (`src/routes/auth/forgot-password/+page.svelte`)~~ — Complete
- ~~Reset Password (`src/routes/auth/reset-password/+page.svelte`)~~ — Complete
- ~~Confirm (`src/routes/auth/confirm/+page.svelte`)~~ — Complete
- ~~Callback (`src/routes/auth/callback/+page.svelte`)~~ — Complete

### ~~3.7 Other Components~~

**Status**: All complete (updated 2026-03-07):
- ~~PremiumFeatureModal.svelte~~ — uses `$t.premium.*` keys
- ~~NotificationsModal.svelte~~ — uses `$t.notifications.*` fallback keys
- ~~InviteMemberModal.svelte~~ — uses `$t.invite.*` keys
- ~~CustomTimezoneSelect.svelte~~ — uses `$t.timezone_select.*` keys
- ~~HouseholdSetupModal.svelte~~ — already used `$t.settings.timezone`

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
- `['M', 'T', 'W', 'T', 'F', 'S', 'S']` appears in `add/+page.svelte` (pet settings is now localized)
- Portuguese would use: `['S', 'T', 'Q', 'Q', 'S', 'S', 'D']`

### AM/PM vs 24-Hour
- TimePicker shows AM/PM — Portuguese users typically use 24-hour format

### `alert()` / `confirm()` Calls
- ~45 total across the app with English text
- These are browser-native dialogs and can't be styled, but the text inside should be localized

### Invite Status Labels
- `invite.status` is displayed raw from the database (`pending`, `accepted`, `declined`)
- These should map through i18n (already have keys: `$t.invite.status_pending`, etc.)
