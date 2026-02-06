import { writable, derived } from 'svelte/store';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile } from '$lib/db';
import { nativePremiumStatus } from '$lib/services/purchases';

export const currentUser = writable<User | null>(null);
export const currentSession = writable<Session | null>(null);
export const currentProfile = writable<Profile | null>(null);

// Derived: user's subscription tier and premium status
export const userTier = derived(currentProfile, ($profile) => $profile?.tier || 'free');

// Is Premium if:
// 1. Database says 'premium' (Web Subscription or Synced)
// 2. Native IAP says 'true' (RevenueCat Entitlement)
export const userIsPremium = derived(
    [userTier, nativePremiumStatus],
    ([$tier, $native]) => $tier === 'premium' || $native
);
