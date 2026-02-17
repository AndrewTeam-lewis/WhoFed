import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface HouseholdState {
    id: string;
    name: string; // Actual name or "My Household" fallback
    role: 'owner' | 'member';
    subscription_status?: string;
    ownerName?: string; // Owner's full name for display
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
