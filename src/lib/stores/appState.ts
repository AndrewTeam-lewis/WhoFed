import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { supabase } from '$lib/supabase';

export interface HouseholdState {
    id: string;
    name: string; // Actual name or "My Household" fallback
    role: 'owner' | 'member';
    subscription_status?: string;
    ownerName?: string; // Owner's full name for display
    timezone?: string; // Household timezone
}

// Stores
// Stores
// Try to recover ID immediately to prevent "flash" of default
const initialId = browser ? localStorage.getItem('whofed_active_hh_id') : null;
// We initialize with a partial object if we have an ID, so UI knows we are "loading specific household"
const initialState = initialId ? { id: initialId, name: 'Loading...', role: 'member' } as HouseholdState : null;

export const activeHousehold = writable<HouseholdState | null>(initialState);
export const availableHouseholds = writable<HouseholdState[]>([]);

// Persistence Keys
const STORAGE_KEY = 'whofed_active_hh_id';

// Helper to switch household
export function switchHousehold(household: HouseholdState) {
    activeHousehold.set(household);
    if (browser) {
        localStorage.setItem(STORAGE_KEY, household.id);
    }
}

// Helper to get stored ID
export function getStoredHouseholdId(): string | null {
    if (browser) {
        return localStorage.getItem(STORAGE_KEY);
    }
    return null;
}

// Validate that the current user is still a member of the household
export async function validateHouseholdMembership(householdId: string, userId: string): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from('household_members')
            .select('user_id')
            .eq('household_id', householdId)
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            console.error('[Membership Validation] Error checking membership:', error);
            return false;
        }

        const isMember = !!data;

        if (!isMember) {
            console.warn('[Membership Validation] User is no longer a member of household:', householdId);
            // Remove from available households
            const current = get(availableHouseholds);
            const updated = current.filter(h => h.id !== householdId);
            availableHouseholds.set(updated);

            // If this was the active household, switch to another or clear
            const active = get(activeHousehold);
            if (active?.id === householdId) {
                if (updated.length > 0) {
                    switchHousehold(updated[0]);
                } else {
                    activeHousehold.set(null);
                    if (browser) {
                        localStorage.removeItem(STORAGE_KEY);
                    }
                }
            }
        }

        return isMember;
    } catch (err) {
        console.error('[Membership Validation] Unexpected error:', err);
        return false;
    }
}
