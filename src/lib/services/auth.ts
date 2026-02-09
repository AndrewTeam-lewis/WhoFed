import { supabase } from '$lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';

export interface RegisterData {
    email: string;
    password: string;
    firstName: string;
}

export interface Profile {
    id: string;
    username: string | null;
    first_name: string | null;
    tier?: string; // 'free' | 'premium'
}

export const authService = {
    // Register with email/password
    async register(data: RegisterData) {
        // Sign up with Supabase Auth
        const { data: authData, error } = await supabase.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
                data: {
                    first_name: data.firstName
                }
            }
        });

        if (error) throw error;
        if (!authData.user) throw new Error('Registration failed');

        // Create profile
        await this.createProfile(authData.user.id, {
            first_name: data.firstName,
            username: null // helper for TS, though optional
        });

        return authData;
    },

    // Login with email OR username
    // Login with email
    async login(email: string, password: string) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;
        return data;
    },

    // Sign in with Google OAuth
    async signInWithGoogle() {
        const redirectTo = Capacitor.isNativePlatform()
            ? 'com.whofed.me://google-auth'
            : `${window.location.origin}/auth/callback`;

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo,
                skipBrowserRedirect: false // Ensure we redirect
            }
        });

        if (error) throw error;
        return data;
    },

    // Create profile for OAuth users (and auto-create household)
    async createProfile(userId: string, profileData: Omit<Profile, 'id'>) {
        // 1. Create Profile
        const { data, error } = await supabase
            .from('profiles')
            .insert({
                id: userId,
                first_name: profileData.first_name
            })
            .select() // Add select to return the inserted row
            .single();

        if (error) throw error;

        // 2. Create Default Household
        const { data: household, error: hhError } = await supabase
            .from('households')
            .insert({
                owner_id: userId,
                subscription_status: 'free'
            })
            .select()
            .single();

        if (hhError) {
            console.error('Failed to create default household:', hhError);
            // Don't fail the whole request, but log it. User can create one later.
            return data;
        }

        // 3. Add User as Member of their own household
        const { error: memberError } = await supabase
            .from('household_members')
            .insert({
                household_id: household.id,
                user_id: userId,
                is_active: true,
                can_log: true,
                can_edit: true
            });

        if (memberError) {
            console.error('Failed to add user to their own household:', memberError);
        }

        return data;
    },

    // Get user profile
    async getProfile(userId: string): Promise<Profile | null> {
        console.log('[DEBUG authService.getProfile] START for userId:', userId);
        console.time('[DEBUG authService.getProfile] Supabase query');

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        console.timeEnd('[DEBUG authService.getProfile] Supabase query');
        console.log('[DEBUG authService.getProfile] Query complete. Data:', data, 'Error:', error);

        if (error) {
            console.log('[DEBUG authService.getProfile] Returning null due to error');
            return null;
        }

        console.log('[DEBUG authService.getProfile] Returning data');
        return data;
    },

    // Update profile
    async updateProfile(userId: string, updates: Partial<Omit<Profile, 'id'>>) {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Get current session
    async getSession(): Promise<Session | null> {
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    },

    // Get current user
    async getCurrentUser(): Promise<User | null> {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    },

    // Logout
    async logout() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    // Listen to auth state changes
    onAuthStateChange(callback: (session: Session | null) => void) {
        return supabase.auth.onAuthStateChange((_event, session) => {
            callback(session);
        });
    }
};
