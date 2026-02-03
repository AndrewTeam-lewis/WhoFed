# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev              # Start dev server
npm run build            # Production build (static SPA via adapter-static)
npm run preview          # Preview production build
npm run check            # TypeScript type checking with svelte-check
npm run check:watch      # Type checking in watch mode
```

No test runner or linter is configured in this project.

## Version Requirement

**CRITICAL**: After ANY code change, increment the version in `src/lib/version.ts`. This is how the user verifies devices are running the latest code.

## AI Behavioral Rules (from AI_RULES.md)

- Do not implement features, optimizations, or improvements unless explicitly asked. Ask first.
- Change only what is requested. Do not refactor, add toggles, or modify adjacent code.
- For anything beyond a one-line fix: state what you will do and wait for confirmation before writing code.
- Do not bundle multiple tasks. Finish one, then ask for the next.
- Do not run automatic UI testing.

## Architecture Overview

**WhoFed** is a pet care coordination app for households. Users create households, add pets with feeding/medication/litter schedules, and track task completion across family members.

### Tech Stack
- **SvelteKit 2** with **Svelte 5** (client-side only, SSR disabled)
- **TypeScript**, **Tailwind CSS 4**, **Vite 7**
- **Supabase** (PostgreSQL + Auth + RLS policies)
- **Capacitor 8** for Android native wrapper
- **Dexie** (IndexedDB) for offline profile caching
- Static SPA build via `@sveltejs/adapter-static` (fallback: `index.html`)

### Key Architecture Decisions
- All routes have `ssr = false` and `prerender = false` (pure SPA)
- `trailingSlash = 'always'` is configured globally
- Supabase handles auth (email/password + Google OAuth), database, and row-level security
- Offline-first: Dexie caches profile data locally in IndexedDB
- Database types are generated from Supabase schema (`src/lib/database.types.ts`)

### Data Model (Supabase/PostgreSQL)
- **profiles** - User accounts (linked to Supabase auth.users)
- **households** - Groups of users, with owner and subscription status
- **household_members** - Junction table with `can_log` and `can_edit` permissions
- **pets** - Belong to a household, have species, name, timezone
- **schedules** - Per-pet task definitions (task_type: feeding/medication/litter, schedule_mode, target_times array)
- **activity_log** - Records of completed tasks (who did what, when)

### State Management
- `src/lib/stores/appState.ts` - Active household and navigation state
- `src/lib/stores/user.ts` - Current user session and profile
- `src/lib/stores/onboarding.ts` - Onboarding/walkthrough UI state

### Service Layer
- `src/lib/services/auth.ts` - Authentication flows (login, register, OAuth, password reset)
- `src/lib/services/taskService.ts` - Task generation from schedules and completion tracking
- `src/lib/taskUtils.ts` - Task generation logic utilities

### Routing
SvelteKit file-based routing under `src/routes/`:
- `/` - Dashboard (main task view, tasks grouped by pet)
- `/auth/*` - Login, register, OAuth callback, password reset, profile completion
- `/pets/add/` - Add new pet with schedules
- `/pets/[id]/settings/` - Edit pet schedules
- `/pets/[id]/history/` - Pet activity history
- `/join/` - Join household via QR code/link
- `/profile/` - User profile
- `/settings/` - App settings
- `/debug/` - Debug utilities

### Deployment
- **Web**: Vercel (static hosting with SPA rewrite rules in `vercel.json`)
- **Mobile**: Capacitor builds targeting Android (`android/` directory)
- Environment variables prefixed with `VITE_` for Supabase URL and anon key
