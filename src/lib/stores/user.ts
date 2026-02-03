import { writable, derived } from 'svelte/store';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile } from '$lib/db';

export const currentUser = writable<User | null>(null);
export const currentSession = writable<Session | null>(null);
export const currentProfile = writable<Profile | null>(null);

// Derived: user's subscription tier and premium status
export const userTier = derived(currentProfile, ($profile) => $profile?.tier || 'free');
export const userIsPremium = derived(userTier, ($tier) => $tier === 'premium');
