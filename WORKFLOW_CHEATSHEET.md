# WhoFed Development Workflow Cheat Sheet

Quick reference for dev → QA → prod workflow.

---

## 🚀 Quick Commands

### Local Development
```bash
npm run dev                    # Start dev server (localhost:5173)
npm run build:dev              # Build for dev environment
npm run build:qa               # Build for QA environment
npm run build:prod             # Build for production environment
```

### Mobile Testing
```bash
npm run android:dev            # Build + sync + run dev on Android
npm run android:qa             # Build + sync + run QA on Android
npm run android:prod           # Build + sync prod (no run)
```

### Manual Sync (if needed)
```bash
npm run sync:dev               # Sync dev build to Capacitor
npm run sync:qa                # Sync QA build to Capacitor
npm run sync:prod              # Sync prod build to Capacitor
npx cap open android           # Open Android Studio
```

---

## 📋 Daily Workflow

### 1️⃣ Working on a Feature

```bash
# Start local dev server
npm run dev

# Make code changes
# Changes appear instantly at http://localhost:5173

# Test on real device
npm run android:dev
```

**What you'll see:**
- Blue "DEVELOPMENT" badge
- Connects to dev database (orjsgwpukribilmjzkat)
- Bundle ID: `com.whofed.dev`

---

### 2️⃣ Database Changes (if needed)

```bash
# Link to dev database
npx supabase link --project-ref orjsgwpukribilmjzkat

# Create new migration
npx supabase migration new add_feature_name

# Edit migration file in supabase/migrations/
# Add your SQL

# Apply to dev database
npx supabase db push

# Test that it works!
```

---

### 3️⃣ Commit Changes

```bash
git add .
git commit -m "Add feature X"
git push origin main
```

**Don't tag yet!** Wait until QA passes.

---

### 4️⃣ Promote to QA

```bash
# Build QA version
npm run build:qa
npm run sync:qa

# If you have migrations, apply to QA:
npx supabase link --project-ref mjmfxjhdvguiaaebkzxd
npx supabase db push

# Open Android Studio
npx cap open android
# Build → Generate Signed Bundle/APK

# Upload to Google Play Console → Internal Testing
```

**What you'll see:**
- Yellow "QA" badge
- Connects to QA database (mjmfxjhdvguiaaebkzxd)
- Bundle ID: `com.whofed.qa`

**Test thoroughly!** If bugs found, go back to step 1.

---

### 5️⃣ Deploy to Production

```bash
# Tag the release
git tag v0.3.6
git push origin main --tags

# Build production version
npm run build:prod
npm run sync:prod

# Apply migrations to PRODUCTION (CAREFUL!)
npx supabase link --project-ref ryrwlkbzyldzbscvcqjh
npx supabase db push

# Open Android Studio
npx cap open android
# Build → Generate Signed Bundle/APK (RELEASE MODE)

# Upload to Google Play Console → Production
# Submit for review
```

**What users will see:**
- No badge (hidden)
- Connects to prod database (ryrwlkbzyldzbscvcqjh)
- Bundle ID: `com.whofed.me`

---

## 🗄️ Supabase Project IDs

```bash
# Dev
npx supabase link --project-ref orjsgwpukribilmjzkat

# QA
npx supabase link --project-ref mjmfxjhdvguiaaebkzxd

# Production
npx supabase link --project-ref ryrwlkbzyldzbscvcqjh
```

---

## 🏷️ Version Management

### Update Version (REQUIRED for all changes)

```typescript
// src/lib/version.ts
export const APP_VERSION = '0.3.6'; // Increment this!
```

**Versioning Rules:**
- **Major** (1.0.0): Breaking changes
- **Minor** (0.4.0): New features
- **Patch** (0.3.6): Bug fixes

---

## 📱 Environment Badges

| Environment | Badge Color | Text |
|-------------|-------------|------|
| Development | Blue | "DEVELOPMENT" |
| QA | Yellow | "QA" |
| Production | None | (hidden) |

---

## 🔧 Troubleshooting

### Bundle ID not updating
```bash
rm -rf android/build android/.gradle
npm run sync:dev  # or sync:qa, sync:prod
```

### Environment variables not loading
Make sure you're using the right build command:
- ✅ `npm run build:dev` (uses .env.development)
- ❌ `npm run build` (uses default .env)

### Migration conflicts
```bash
# Reset database
npx supabase db reset

# Re-apply all migrations
npx supabase db push
```

### Can't tell which environment you're in
Look for the badge in the top-right corner of the app!

---

## 📦 Build Outputs

### Development
- App name: "WhoFed Dev"
- Badge: Blue "DEVELOPMENT"
- Database: Dev Supabase
- Bundle ID: `com.whofed.dev`

### QA
- App name: "WhoFed (QA)"
- Badge: Yellow "QA"
- Database: QA Supabase
- Bundle ID: `com.whofed.qa`

### Production
- App name: "WhoFed"
- Badge: None
- Database: Production Supabase
- Bundle ID: `com.whofed.me`

---

## 🎯 Pre-Release Checklist

Before deploying to production:

- [ ] Tested on dev environment
- [ ] Applied migrations to dev successfully
- [ ] Built QA version and uploaded to Internal Testing
- [ ] Tested QA version on real device
- [ ] All features working in QA
- [ ] Version number incremented in `src/lib/version.ts`
- [ ] Changes committed and pushed to git
- [ ] Created git tag (e.g., `v0.3.6`)
- [ ] Applied migrations to production database
- [ ] Built production APK in RELEASE mode
- [ ] Uploaded to Google Play Production track

---

## 🚨 Emergency Rollback

If production breaks:

```bash
# 1. Find last working tag
git tag

# 2. Checkout that tag
git checkout v0.3.5

# 3. Build and deploy
npm run build:prod
npm run sync:prod
# Build and upload to Play Store

# 4. Restore database (if needed)
# Go to Supabase Dashboard → Settings → Backups → Restore
```

---

## 💾 Backup Strategy

- **Production**: Daily auto-backups (Supabase paid plan)
- **Migrations**: All in git (`supabase/migrations/`)
- **Recovery**: Restore from Supabase Dashboard → Settings → Backups

---

## 📞 Quick Reference Links

- **Supabase Dashboard**: https://supabase.com/dashboard
- **Google Play Console**: https://play.google.com/console
- **GitHub Repo**: (your repo URL)
- **Deployment Guide**: See DEPLOYMENT.md for detailed instructions

---

## 🎓 Remember

1. **Always test in dev first**
2. **Never skip QA** - it catches bugs before users see them
3. **Increment version.ts** for every change
4. **Tag releases** - makes rollback easy
5. **Test migrations** on dev and QA before prod
6. **Double-check** which database you're linked to before `db push`

---

## 🆘 Common Mistakes

❌ Running `npm run build` instead of `npm run build:dev`
❌ Forgetting to increment version.ts
❌ Pushing migrations to prod without testing on QA
❌ Not tagging releases
❌ Building in debug mode instead of release for production

✅ Always use environment-specific build commands
✅ Update version for every deployment
✅ Test migrations: dev → QA → prod
✅ Tag every production release
✅ Use release mode for production builds

---

**Last Updated:** 2026-02-21
**Current Version:** 0.3.5
