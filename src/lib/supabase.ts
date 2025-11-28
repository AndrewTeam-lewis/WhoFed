import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Placeholder for sync logic
export async function syncUsersToSupabase() {
    // Logic to find unsynced users in Dexie and push to Supabase
    // Then mark as synced in Dexie
    console.log('Syncing users to Supabase...');
}
