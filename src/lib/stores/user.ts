import { writable } from 'svelte/store';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile } from '$lib/db';

export const currentUser = writable<User | null>(null);
export const currentSession = writable<Session | null>(null);
export const currentProfile = writable<Profile | null>(null);
