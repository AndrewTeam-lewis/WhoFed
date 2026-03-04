# RevenueCat Setup & Premium System Guide

**Last Updated:** 2026-03-04

---

## 🎯 Overview

WhoFed uses a **dual premium system**:
1. **Mobile (Android/iOS)**: RevenueCat handles IAP → Instant premium access
2. **Web**: Database `profiles.tier` field → Web-based premium access

**The webhook handler syncs them together!**

---

## 📊 Current Architecture

### Premium Detection Logic

```typescript
// src/lib/stores/user.ts
export const userIsPremium = derived(
    [userTier, nativePremiumStatus],
    ([$tier, $native]) => $tier === 'premium' || $native
);
```

**Premium is granted if EITHER:**
- `profiles.tier = 'premium'` (database) **OR**
- RevenueCat entitlement `'premium'` is active (mobile only)

### Mobile Purchase Flow

```
User Taps "Get Premium"
       ↓
Google Play/App Store Payment
       ↓
RevenueCat Confirms Purchase
       ↓
   ┌──────┴──────┐
   │             │
App Updated   Webhook Sent
   ↓             ↓
nativePremium  Database Synced
Status = true  tier = 'premium'
   │             │
   └──────┬──────┘
          ↓
   Premium Works Everywhere! ✅
```

---

## 🔧 Setup Instructions

### Step 1: Deploy Webhook Handler

```bash
# Deploy the RevenueCat webhook function
cd /Users/Andrew/Code/WhoFed
supabase functions deploy revenuecat-webhook
```

### Step 2: Set Environment Variable (Optional)

For added security, set a webhook secret:

```bash
# In Supabase Dashboard → Edge Functions → revenuecat-webhook → Secrets
REVENUECAT_WEBHOOK_SECRET=your-random-secret-here
```

**Or via CLI:**
```bash
supabase secrets set REVENUECAT_WEBHOOK_SECRET=your-random-secret-here
```

### Step 3: Configure RevenueCat Dashboard

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com)
2. Select your project → **Integrations** → **Webhooks**
3. Click "**+ New Webhook**"
4. Configure:
   - **URL**: `https://[your-project-id].supabase.co/functions/v1/revenuecat-webhook`
   - **Authorization** (if using secret):
     - Header: `Authorization`
     - Value: `Bearer your-random-secret-here`
   - **Events to Send**: Select ALL or at minimum:
     - ✅ INITIAL_PURCHASE
     - ✅ RENEWAL
     - ✅ CANCELLATION
     - ✅ EXPIRATION
     - ✅ BILLING_ISSUE
     - ✅ UNCANCELLATION
     - ✅ NON_RENEWING_PURCHASE

5. Click "**Save**"

### Step 4: Test the Webhook

#### Option A: Test Purchase (Recommended)
1. Use a test account in your app
2. Make a test purchase (use Google Play Console test account)
3. Check logs: `supabase functions logs revenuecat-webhook`
4. Verify database: Check if `profiles.tier` updated to `'premium'`

#### Option B: Manual Webhook Test
1. In RevenueCat Dashboard → Webhooks → Your webhook
2. Click "**Send Test Event**"
3. Choose event type: `INITIAL_PURCHASE`
4. Check logs and database

---

## 🔒 Security

### Webhook Authentication

The webhook verifies requests using the `Authorization` header:

```typescript
const authHeader = req.headers.get('authorization');
const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');

if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
    return Response 401 Unauthorized
}
```

**Why this matters:**
- Prevents unauthorized parties from granting premium status
- Ensures webhook calls are genuinely from RevenueCat
- Protects against replay attacks

### Additional Security Measures

1. **Use HTTPS**: Webhook URL must be HTTPS (Supabase provides this)
2. **Environment Variables**: Never hardcode secrets in code
3. **Service Role Key**: Webhook uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS

---

## 📝 Webhook Event Types

### Handled Events

| Event Type | Description | Action |
|------------|-------------|--------|
| **INITIAL_PURCHASE** | First-time purchase | Set `tier = 'premium'` |
| **RENEWAL** | Subscription renewed | Set `tier = 'premium'` |
| **UNCANCELLATION** | User reactivated | Set `tier = 'premium'` |
| **CANCELLATION** | Subscription cancelled | Set `tier = 'free'` |
| **EXPIRATION** | Subscription expired | Set `tier = 'free'` |
| **BILLING_ISSUE** | Payment failed | Set `tier = 'free'` |
| **NON_RENEWING_PURCHASE** | Lifetime purchase | Set `tier = 'premium'` |

### Webhook Payload Example

```json
{
  "type": "INITIAL_PURCHASE",
  "app_user_id": "user-uuid-here",
  "product_id": "premium_monthly",
  "entitlement_ids": ["premium"],
  "presented_offering_id": "default",
  "transaction_id": "GPA.1234-5678-9012",
  "original_transaction_id": "GPA.1234-5678-9012",
  "purchased_at_ms": 1704124800000,
  "expiration_at_ms": 1706803200000,
  "is_trial_period": false
}
```

---

## 🧪 Testing Guide

### Test Scenario 1: New Purchase

**Steps:**
1. Fresh user account (free tier)
2. Purchase premium in mobile app
3. **Expected Results:**
   - ✅ `nativePremiumStatus` = true (instant)
   - ✅ `profiles.tier` = 'premium' (within seconds via webhook)
   - ✅ Premium features unlock in app
   - ✅ Premium features work on web

### Test Scenario 2: Renewal

**Steps:**
1. User with active subscription
2. Wait for renewal date (or trigger test renewal in RevenueCat)
3. **Expected Results:**
   - ✅ Webhook received
   - ✅ `profiles.tier` stays 'premium'
   - ✅ No disruption to service

### Test Scenario 3: Cancellation

**Steps:**
1. User cancels subscription in Google Play
2. **Expected Results:**
   - ✅ Webhook received immediately
   - ✅ `profiles.tier` set to 'free'
   - ✅ Premium features locked
   - ✅ User sees upgrade prompt

### Test Scenario 4: Cross-Platform

**Steps:**
1. Purchase premium on Android
2. Login on iOS
3. Login on web
4. **Expected Results:**
   - ✅ Premium works on Android (RevenueCat)
   - ✅ Premium works on iOS (RevenueCat syncs across devices)
   - ✅ Premium works on web (database tier)

---

## 🐛 Troubleshooting

### Issue: Webhook not receiving events

**Possible Causes:**
1. Webhook URL incorrect
2. RevenueCat webhook not configured
3. Firewall blocking requests

**Solutions:**
- Verify URL: `https://[your-project-id].supabase.co/functions/v1/revenuecat-webhook`
- Check RevenueCat Dashboard → Webhooks → Status
- View webhook logs in RevenueCat Dashboard

### Issue: Premium granted in app but not on web

**Possible Causes:**
1. Webhook handler not deployed
2. Database update failed
3. Webhook secret mismatch

**Solutions:**
- Check logs: `supabase functions logs revenuecat-webhook`
- Verify database: `SELECT id, tier FROM profiles WHERE id = 'user-id'`
- Test webhook manually in RevenueCat Dashboard

### Issue: Premium revoked incorrectly

**Possible Causes:**
1. Subscription actually expired
2. Payment failed (billing issue)
3. User refunded purchase

**Solutions:**
- Check RevenueCat Dashboard → Customer → Purchase history
- Verify subscription status in Google Play Console
- Review webhook logs for CANCELLATION/EXPIRATION events

### Issue: Database not updating

**Possible Causes:**
1. User ID mismatch (app uses different ID than database)
2. RLS policies blocking update
3. Database connection error

**Solutions:**
- Verify `app_user_id` in webhook matches `profiles.id`
- Webhook uses SERVICE_ROLE_KEY (bypasses RLS)
- Check Edge Function logs for errors

---

## 🔄 Manual Sync (Emergency)

If webhook fails and you need to manually sync a user:

### Option 1: Dev Toggle (Settings Page)

1. Login as the user
2. Go to Settings
3. Find "Your Account" section
4. Click "[Dev: Toggle]" button next to tier status
5. Refreshes page with new tier

**Location:** [src/routes/settings/+page.svelte](../src/routes/settings/+page.svelte) line 1341

### Option 2: Database Query

```sql
-- Grant premium to specific user
UPDATE profiles
SET tier = 'premium'
WHERE id = 'user-uuid-here';

-- Revoke premium from specific user
UPDATE profiles
SET tier = 'free'
WHERE id = 'user-uuid-here';
```

### Option 3: Supabase Dashboard

1. Go to Supabase Dashboard → Table Editor
2. Select `profiles` table
3. Find the user by ID or email
4. Edit `tier` column → Set to `'premium'` or `'free'`
5. Save

---

## 📊 Monitoring & Analytics

### Webhook Success Rate

Check RevenueCat Dashboard → Webhooks → Your webhook → **Deliveries**

**Metrics to monitor:**
- Success rate (should be >99%)
- Average response time (<1 second)
- Failed deliveries (investigate any failures)

### Database Tier Distribution

```sql
-- Count users by tier
SELECT tier, COUNT(*) as count
FROM profiles
GROUP BY tier;
```

### Recent Premium Conversions

```sql
-- Users who upgraded in last 7 days
SELECT id, email, first_name, tier, updated_at
FROM profiles
WHERE tier = 'premium'
  AND updated_at > NOW() - INTERVAL '7 days'
ORDER BY updated_at DESC;
```

---

## 🚀 Production Checklist

Before going live:

- [ ] **Webhook deployed**: `supabase functions deploy revenuecat-webhook`
- [ ] **Secret configured** (optional): `REVENUECAT_WEBHOOK_SECRET`
- [ ] **RevenueCat webhook configured** with correct URL
- [ ] **Webhook tested** with test purchase or manual test event
- [ ] **Database tier updates verified** after test purchase
- [ ] **Cross-platform tested**: Purchase on mobile, verify on web
- [ ] **Cancellation tested**: Cancel subscription, verify tier revoked
- [ ] **Monitoring set up**: Check webhook success rate regularly

---

## 📞 Support

If you encounter issues:

1. **Check logs first**:
   ```bash
   supabase functions logs revenuecat-webhook --tail
   ```

2. **Verify webhook in RevenueCat**:
   - Dashboard → Webhooks → View delivery history

3. **Test with manual event**:
   - Send test event from RevenueCat Dashboard

4. **Database verification**:
   ```sql
   SELECT * FROM profiles WHERE id = 'problem-user-id';
   ```

---

## 🔗 Related Documentation

- [PREMIUM_FEATURES.md](./PREMIUM_FEATURES.md) - Feature gating details
- [RevenueCat Docs](https://docs.revenuecat.com/docs/webhooks) - Official webhook documentation
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions) - Edge function docs

---

**Ready to deploy!** 🚀
