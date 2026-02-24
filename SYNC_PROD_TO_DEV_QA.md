# Sync Production Database to Dev/QA

This guide shows how to do a complete one-time sync of your production Supabase database to dev and QA environments.

---

## Prerequisites

### 1. Install Docker Desktop

1. Go to https://www.docker.com/products/docker-desktop
2. Download Docker Desktop for Mac
3. Install and start Docker Desktop
4. Wait for Docker to fully start (whale icon in menu bar should be steady, not animated)

---

## Step 1: Export from Production

```bash
# Link to production
npx supabase link --project-ref ryrwlkbzyldzbscvcqjh

# Export complete database schema
npx supabase db dump --data-only=false > prod_complete.sql
```

**Result:** You now have `prod_complete.sql` with all tables, functions, policies, indexes, and extensions.

---

## Step 2: Apply to DEV

### 2.1 Link to Dev

```bash
npx supabase link --project-ref orjsgwpukribilmjzkat
```

### 2.2 Open DEV SQL Editor

Go to: https://supabase.com/dashboard/project/orjsgwpukribilmjzkat/sql/new

### 2.3 Wipe Dev Clean

```sql
-- NUCLEAR OPTION: Drop everything in public schema
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Restore default permissions
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
```

### 2.4 Enable Extensions

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_graphql;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 2.5 Apply Production Schema

1. Open `prod_complete.sql` file
2. Copy the **entire contents**
3. Paste into DEV SQL Editor
4. Click "Run"

### 2.6 Create Auth Trigger

```sql
-- Create the auth trigger that auto-creates profiles
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

---

## Step 3: Apply to QA

### 3.1 Link to QA

```bash
npx supabase link --project-ref mjmfxjhdvguiaaebkzxd
```

### 3.2 Open QA SQL Editor

Go to: https://supabase.com/dashboard/project/mjmfxjhdvguiaaebkzxd/sql/new

### 3.3 Repeat Steps 2.3 - 2.6

Run the same SQL commands as you did for DEV:
1. Wipe clean (DROP SCHEMA CASCADE)
2. Enable extensions
3. Paste and run `prod_complete.sql`
4. Create auth trigger

---

## Step 4: Deploy Edge Functions

```bash
# Deploy to dev
npx supabase functions deploy --project-ref orjsgwpukribilmjzkat

# Deploy to QA
npx supabase functions deploy --project-ref mjmfxjhdvguiaaebkzxd
```

---

## Verification

After syncing, verify each environment:

### Test User Creation
1. Sign up a new user in dev
2. Check that profile is auto-created

### Test Household Creation
1. Create a household
2. Should work without infinite recursion errors

### Check Functions
```sql
-- Run in each environment to verify functions exist
SELECT proname FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
ORDER BY proname;
```

---

## Project References

- **Production:** ryrwlkbzyldzbscvcqjh
- **Dev:** orjsgwpukribilmjzkat
- **QA:** mjmfxjhdvguiaaebkzxd

---

## How to Run Each Environment

### Development
```bash
npm run dev
```
Access at: http://localhost:5173
Uses: `.env.development` (dev database)

### QA
```bash
npm run dev:qa
```
Access at: http://localhost:5173
Uses: `.env.qa` (QA database)

### Production
Production automatically deploys to Vercel when you push to git.
Access at: https://your-app.vercel.app
Uses: Vercel environment variables (prod database)

---

## Notes

- This is a **one-time sync** to get dev/qa in perfect alignment with prod
- Going forward, use migration files to manage schema changes
- The auth trigger must be created manually because it's on the `auth.users` table (outside public schema)
- Edge functions are deployed separately via Supabase CLI
- Extensions must be enabled before running the schema dump
- QA runs locally (not deployed) - it's for testing before pushing to production
