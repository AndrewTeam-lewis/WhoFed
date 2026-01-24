import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { db } from '$lib/db';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!import.meta.env.VITE_SUPABASE_URL) {
    console.warn('VITE_SUPABASE_URL not found. Supabase client will fail on network requests.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export async function syncUsersToSupabase() {
    console.log('Starting sync of profiles to Supabase...');
    try {
        const profiles = await db.profiles.toArray();
        console.log(`Found ${profiles.length} local profiles to sync.`);

        if (profiles.length === 0) return;

        const { error } = await supabase
            .from('profiles')
            .upsert(profiles);

        if (error) {
            console.error('Error syncing profiles:', error);
            throw error;
        }

        console.log('Sync completed successfully.');
    } catch (e) {
        console.error('Sync failed:', e);
        throw e;
    }
}
