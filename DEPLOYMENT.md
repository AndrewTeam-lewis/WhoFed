# WhoFed Deployment Guide

This document explains how to build and deploy WhoFed across development, QA, and production environments.

## Overview

WhoFed uses three separate environments:
- **Development** - Local testing, rapid iteration
- **QA** - Pre-release testing on real devices
- **Production** - Public app store releases

Each environment has:
- Separate Supabase project (isolated databases and auth)
- Different bundle ID (allows side-by-side installation)
- Different environment variables
- Environment badge (DEV/QA visible, hidden in prod)

---

## Prerequisites

### Supabase Projects

Create three Supabase projects:
1. **Dev**: Free tier, for local testing
2. **QA**: Free tier or cheap, for pre-release testing
3. **Prod**: Paid plan with daily backups (current project)

### Environment Files

Fill in your Supabase credentials in each `.env` file:

**`.env.development`**
```env
VITE_SUPABASE_URL=https://YOUR_DEV_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_DEV_ANON_KEY
```

**`.env.qa`**
```env
VITE_SUPABASE_URL=https://YOUR_QA_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_QA_ANON_KEY
```

**`.env.production`**
Already configured with production credentials.

---

## Development Workflow

### 1. Local Testing (Dev)

```bash
# Run dev server (hot reload)
npm run dev

# Build for dev environment
npm run build:dev

# Build + sync to Android
npm run android:dev
```

**Bundle ID:** `com.whofed.dev`
**Badge:** Blue "DEVELOPMENT" badge visible
**Database:** Dev Supabase project

### 2. QA Testing (Pre-Release)

```bash
# Build for QA
npm run build:qa

# Sync to Capacitor
npm run sync:qa

# Open Android Studio
npx cap open android
```

Then in Android Studio:
1. Build → Generate Signed Bundle/APK
2. Upload AAB to **Google Play Internal Testing** track
3. Test on real devices

**Bundle ID:** `com.whofed.qa`
**Badge:** Yellow "QA" badge visible
**Database:** QA Supabase project

### 3. Production Release

```bash
# Build for production
npm run build:prod

# Sync to Capacitor
npm run sync:prod

# Open Android Studio
npx cap open android
```

Then in Android Studio:
1. Build → Generate Signed Bundle/APK (release mode)
2. Upload AAB to **Google Play Production** track
3. Submit for review

**Bundle ID:** `com.whofed.me`
**Badge:** No badge (hidden in production)
**Database:** Production Supabase project (paid plan with backups)

---

## Database Migrations

### Running Migrations

Test migrations in order: Dev → QA → Prod

```bash
# Dev environment
supabase link --project-ref YOUR_DEV_PROJECT_REF
supabase db push

# QA environment
supabase link --project-ref YOUR_QA_PROJECT_REF
supabase db push

# Production environment (careful!)
supabase link --project-ref YOUR_PROD_PROJECT_REF
supabase db push
```

**Important:** Always test migrations on Dev and QA before running on Prod.

### Migration Workflow

1. Create migration locally: `supabase migration new feature_name`
2. Write SQL in `supabase/migrations/`
3. Test on **Dev** database
4. If successful, test on **QA** database
5. If QA passes, run on **Prod** database
6. Commit migration file to git

---

## Version Management

Update `src/lib/version.ts` after significant changes:

```typescript
export const APP_VERSION = '0.3.5';
```

Use semantic versioning:
- **Major** (1.0.0): Breaking changes
- **Minor** (0.3.0): New features
- **Patch** (0.3.1): Bug fixes

---

## Git Workflow (Solo Developer)

### Simple Main Branch Workflow

```bash
# Make changes
git add .
git commit -m "Add feature X"

# Tag releases
git tag v0.3.5
git push origin main --tags
```

**No branches needed** - just use `main` and tag releases.

### Rolling Back

If production breaks, roll back to previous tag:

```bash
git checkout v0.3.4
npm run build:prod
npm run sync:prod
# Rebuild and redeploy
```

---

## App Store Deployment

### Google Play (Android)

#### Internal Testing (QA)
1. Build QA bundle: `npm run build:qa && npm run sync:qa`
2. Open Android Studio → Build → Generate Signed Bundle/APK
3. Upload to **Internal Testing** track (instant, no review)
4. Test with real devices

#### Production Release
1. Build prod bundle: `npm run build:prod && npm run sync:prod`
2. Open Android Studio → Build → Generate Signed Bundle/APK (release)
3. Upload to **Production** track
4. Wait 1-3 days for review
5. Release to public

### Apple App Store (iOS - Future)

#### TestFlight (QA)
1. Build QA IPA: `npm run build:qa && npm run sync:qa`
2. Open Xcode → Archive
3. Upload to TestFlight
4. Wait 1-2 days for review
5. Invite beta testers

#### Production Release
1. Build prod IPA: `npm run build:prod && npm run sync:prod`
2. Open Xcode → Archive
3. Submit to App Store
4. Wait 1-7 days for review
5. Release to public

---

## Disaster Recovery

### Backup Strategy

**Production Database:**
- Supabase paid plan: Daily auto-backups (7-day retention)
- Manual backups: `pg_dump` before major changes
- Migrations in git: Can rebuild schema anytime

### Recovery Procedure

1. **Restore from Supabase backup:**
   - Supabase Dashboard → Settings → Backups → Restore
   - Choose backup point (within 7 days)

2. **Restore from manual backup:**
   ```bash
   psql -h YOUR_PROD_DB_HOST -U postgres -d postgres -f backup.sql
   ```

3. **Rebuild from migrations:**
   ```bash
   supabase db reset
   supabase db push
   ```

---

## Environment Badge

The app shows a colored badge in non-production environments:

- **Dev**: Blue "DEVELOPMENT" badge (top-right corner)
- **QA**: Yellow "QA" badge (top-right corner)
- **Prod**: No badge (hidden)

This helps you instantly know which environment you're running.

---

## Troubleshooting

### Bundle ID not updating

```bash
# Clean Capacitor build
rm -rf android/build android/.gradle
npm run sync:dev  # or sync:qa, sync:prod
```

### Environment variables not loading

Check that you're using the correct build script:
```bash
npm run build:dev   # Uses .env.development
npm run build:qa    # Uses .env.qa
npm run build:prod  # Uses .env.production
```

### Migration conflicts

If migration timestamps conflict:
```bash
# Rename migration file to unique timestamp
mv supabase/migrations/old_name.sql supabase/migrations/20260221120000_new_name.sql

# Repair migration history
npx supabase migration repair 20260221120000 --status applied
```

---

## Quick Reference

### Build Commands

| Command | Environment | Use Case |
|---------|-------------|----------|
| `npm run dev` | Development | Local hot-reload dev server |
| `npm run build:dev` | Development | Build dev bundle |
| `npm run build:qa` | QA | Build QA bundle for testing |
| `npm run build:prod` | Production | Build production bundle |
| `npm run android:dev` | Development | Full dev build + sync + run |
| `npm run android:qa` | QA | Full QA build + sync + run |
| `npm run android:prod` | Production | Full prod build + sync (no run) |

### Bundle IDs

| Environment | Bundle ID | Install Alongside |
|-------------|-----------|-------------------|
| Development | `com.whofed.dev` | ✅ Yes |
| QA | `com.whofed.qa` | ✅ Yes |
| Production | `com.whofed.me` | ✅ Yes |

All three can be installed on the same device simultaneously.

---

## Next Steps

1. **Create Dev and QA Supabase projects** in Supabase Dashboard
2. **Fill in `.env.development` and `.env.qa`** with your credentials
3. **Test dev build:** `npm run android:dev`
4. **Run migrations on dev:** `supabase link` → `supabase db push`
5. **Build QA and upload to Google Play Internal Testing**
6. **Test thoroughly before production release**
