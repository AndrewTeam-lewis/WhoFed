

# Stripe Setup Guide for WhoFed

**Complete step-by-step guide to enable web payments**

---

## 🎯 Overview

**Pricing:** $1.99/month or $19.99/year
**Features:** Unlimited pets, households, photos, and PDF exports

---

## 📋 Setup Checklist

- [ ] Create Stripe products and prices
- [ ] Configure environment variables
- [ ] Deploy Edge Functions
- [ ] Configure Stripe webhook
- [ ] Install Stripe package
- [ ] Update settings UI
- [ ] Test checkout flow
- [ ] Go live!

---

## Step 1: Create Stripe Products (10 minutes)

### 1.1 Login to Stripe Dashboard
Go to: https://dashboard.stripe.com

### 1.2 Create Product
1. Click **Products** in left sidebar
2. Click **+ Add product**
3. Fill in:
   - **Name:** WhoFed Premium
   - **Description:** Unlimited pets, households, custom photos, and PDF exports
   - **Image:** (Optional) Upload WhoFed logo

### 1.3 Create Monthly Price
1. Under "Pricing", click **+ Add another price**
2. Configure:
   - **Price:** $1.99
   - **Billing period:** Monthly
   - **Currency:** USD
3. Click **Save product**
4. **COPY THE PRICE ID** (looks like `price_1234ABCDxyz`)
   - Save this as `MONTHLY_PRICE_ID`

### 1.4 Create Annual Price
1. Click on your product
2. Click **+ Add another price**
3. Configure:
   - **Price:** $19.99
   - **Billing period:** Yearly
   - **Currency:** USD
4. Click **Add price**
5. **COPY THE PRICE ID** (looks like `price_5678EFGHijk`)
   - Save this as `ANNUAL_PRICE_ID`

---

## Step 2: Get Stripe API Keys (2 minutes)

### 2.1 Get Publishable Key
1. Click **Developers** → **API keys**
2. Find "Publishable key"
3. Click **Reveal live key** (or use test key for testing)
4. **COPY THIS KEY**
   - Save as `STRIPE_PUBLISHABLE_KEY`

### 2.2 Get Secret Key
1. Same page, find "Secret key"
2. Click **Reveal live key** (or use test key)
3. **COPY THIS KEY** (starts with `sk_live_` or `sk_test_`)
   - Save as `STRIPE_SECRET_KEY`
   - ⚠️ **NEVER commit this to git!**

---

## Step 3: Configure Environment Variables (5 minutes)

### 3.1 Local Development (.env file)
Create/update `.env` file in project root:

```bash
# Stripe Keys
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
VITE_STRIPE_PRICE_MONTHLY=price_1234ABCDxyz
VITE_STRIPE_PRICE_ANNUAL=price_5678EFGHijk
```

### 3.2 Supabase Edge Functions
Set secrets for Edge Functions:

```bash
# Navigate to project directory
cd /Users/Andrew/Code/WhoFed

# Set Stripe secret key
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx

# Set app URL (use your actual domain)
supabase secrets set APP_URL=https://whofed.me
```

### 3.3 Vercel Environment Variables
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   - `VITE_STRIPE_PUBLISHABLE_KEY` = `pk_test_xxxxxxxxxxxxx`
   - `VITE_STRIPE_PRICE_MONTHLY` = `price_1234ABCDxyz`
   - `VITE_STRIPE_PRICE_ANNUAL` = `price_5678EFGHijk`

---

## Step 4: Install Stripe Package (1 minute)

```bash
npm install @stripe/stripe-js
```

---

## Step 5: Deploy Edge Functions (2 minutes)

```bash
# Deploy all Stripe-related functions
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
supabase functions deploy create-portal-session
supabase functions deploy revenuecat-webhook  # Already created
```

Verify deployment:
```bash
supabase functions list
```

You should see:
- ✓ create-checkout-session
- ✓ stripe-webhook
- ✓ create-portal-session
- ✓ revenuecat-webhook
- ✓ send-invite-email
- ✓ send-push

---

## Step 6: Configure Stripe Webhook (5 minutes)

### 6.1 Get Webhook Endpoint URL
Your webhook URL is:
```
https://[your-project-id].supabase.co/functions/v1/stripe-webhook
```

Find your project ID in Supabase Dashboard → Project Settings

### 6.2 Create Webhook in Stripe
1. Stripe Dashboard → **Developers** → **Webhooks**
2. Click **+ Add endpoint**
3. Configure:
   - **Endpoint URL:** `https://xxxxx.supabase.co/functions/v1/stripe-webhook`
   - **Description:** WhoFed Subscription Events
   - **Events to send:** Click **Select events**, then add:
     - ✅ `checkout.session.completed`
     - ✅ `customer.subscription.created`
     - ✅ `customer.subscription.updated`
     - ✅ `customer.subscription.deleted`
     - ✅ `invoice.payment_failed`
4. Click **Add endpoint**

### 6.3 Get Webhook Signing Secret
1. Click on your newly created webhook
2. Under "Signing secret", click **Reveal**
3. **COPY THE SECRET** (starts with `whsec_`)
4. Set it in Supabase:
   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```

---

## Step 7: Run Database Migration (1 minute)

```bash
# Apply the Stripe fields migration
supabase db push
```

This adds `stripe_customer_id` and `stripe_subscription_id` to profiles table.

---

## Step 8: Update Settings Page (already done!)

The premium modal in settings is already set up to use Stripe on web. It will:
- Show RevenueCat prices on mobile
- Show Stripe checkout button on web
- Handle both seamlessly

---

## Step 9: Test the Flow (10 minutes)

### 9.1 Test Mode Purchase
1. Use test keys (`pk_test_...` and `sk_test_...`)
2. Go to https://whofed.me/settings
3. Click "WhoFed Premium" button
4. Click "Upgrade" in modal
5. Use Stripe test card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits
6. Complete checkout
7. Should redirect to success page
8. Check database: `profiles.tier` should be `'premium'`

### 9.2 Test Webhook
1. Stripe Dashboard → **Developers** → **Webhooks** → Your webhook
2. Click **Send test event**
3. Select `checkout.session.completed`
4. Click **Send test webhook**
5. Check logs:
   ```bash
   supabase functions logs stripe-webhook
   ```

### 9.3 Test Customer Portal
1. As a premium user, go to Settings
2. Click "Manage Subscription" (will add this button)
3. Should open Stripe Customer Portal
4. Can cancel/update payment method

---

## Step 10: Update Settings UI for Web (5 minutes)

I need to update the settings page to detect web vs mobile and show appropriate buttons. Let me know when you're ready and I'll make that change!

---

## Step 11: Go Live (When Ready)

### 11.1 Switch to Live Keys
1. Stripe Dashboard → Toggle "Test mode" to OFF
2. Get live keys (starts with `pk_live_` and `sk_live_`)
3. Update environment variables everywhere:
   - `.env` file
   - Vercel
   - Supabase secrets
4. Update webhook to use live webhook secret

### 11.2 Activate Stripe Account
1. Complete Stripe account verification
2. Add business details
3. Add bank account for payouts

### 11.3 Enable Features
- **Stripe Tax:** Auto-calculate taxes (recommended)
- **Billing Portal:** Customize customer portal
- **Email Receipts:** Enable automatic receipts

---

## 💰 Expected Revenue Flow

### Monthly Subscription
- **Customer pays:** $1.99
- **Stripe fee:** ~$0.36 (2.9% + $0.30)
- **You receive:** ~$1.63

### Annual Subscription
- **Customer pays:** $19.99
- **Stripe fee:** ~$0.88 (2.9% + $0.30)
- **You receive:** ~$19.11

**International cards add +1% fee**

### Pricing Rationale
- **$1.99/month** - Affordable for a simple tracker, low barrier to entry
- **$19.99/year** - 2-month discount (saves $3.89), encourages annual commitment
- **Low support expectations** - Price point aligns with "set it and forget it" utility app
- **High volume potential** - Lower price increases conversion rate and market size

---

## 🔍 Monitoring & Analytics

### Key Metrics to Track

**In Stripe Dashboard:**
- Monthly Recurring Revenue (MRR)
- Active subscriptions
- Churn rate
- Failed payments

**In Supabase:**
```sql
-- Count premium users
SELECT COUNT(*) FROM profiles WHERE tier = 'premium';

-- Revenue by source
SELECT
  CASE
    WHEN stripe_customer_id IS NOT NULL THEN 'Web (Stripe)'
    ELSE 'Mobile (RevenueCat)'
  END as source,
  COUNT(*) as count
FROM profiles
WHERE tier = 'premium'
GROUP BY source;
```

---

## 🐛 Troubleshooting

### Issue: Checkout button doesn't work
**Check:**
- Are environment variables set? (Check browser console)
- Is Edge Function deployed? (`supabase functions list`)
- Check Edge Function logs: `supabase functions logs create-checkout-session`

### Issue: Premium not granted after payment
**Check:**
- Webhook configured correctly in Stripe Dashboard?
- Webhook secret set in Supabase? (`supabase secrets list`)
- Check webhook logs: `supabase functions logs stripe-webhook`
- Check Stripe Dashboard → Webhooks → Your webhook → Recent events

### Issue: "No Stripe customer found" in portal
**Cause:** User hasn't subscribed via Stripe yet
**Solution:** Only show "Manage Subscription" for users with `stripe_customer_id`

---

## 📚 Resources

- [Stripe Testing](https://stripe.com/docs/testing)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Checkout](https://stripe.com/docs/payments/checkout)
- [Stripe Customer Portal](https://stripe.com/docs/billing/subscriptions/integrating-customer-portal)

---

## ✅ Completion Checklist

Before going live:
- [ ] Products and prices created in Stripe
- [ ] All environment variables set (local, Vercel, Supabase)
- [ ] Edge Functions deployed
- [ ] Webhook configured and tested
- [ ] Test purchase completed successfully
- [ ] Database updates verified
- [ ] Customer portal tested
- [ ] Switched to live keys
- [ ] Stripe account verified
- [ ] Ready to accept payments! 🎉

---

**Need help?** Check the logs:
```bash
# Checkout errors
supabase functions logs create-checkout-session --tail

# Webhook errors
supabase functions logs stripe-webhook --tail

# All Edge Functions
supabase functions logs --tail
```
