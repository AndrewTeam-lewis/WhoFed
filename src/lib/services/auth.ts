import { supabase } from '$lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';

export interface RegisterData {
    email: string;
    password: string;
    username: string;
    firstName: string;
    lastName?: string;
    phone?: string;
}

export interface Profile {
    id: string;
    username: string;
    first_name: string;
    last_name?: string;
    phone?: string;
    tier?: string; // 'free' | 'premium'
}

export const authService = {
    // Check if username is available
    async checkUsernameAvailable(username: string): Promise<boolean> {
        const { data, error } = await supabase
            .from('profiles')
            .select('username')
            .eq('username', username)
            .single();

        return !data; // Available if no data found
    },

    // Register with email/password
    async register(data: RegisterData) {
        // Check username availability first
        const available = await this.checkUsernameAvailable(data.username);
        if (!available) {
            throw new Error('Username already taken');
        }

        // Sign up with Supabase Auth
        const { data: authData, error } = await supabase.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
                data: {
                    username: data.username,
                    firstName: data.firstName,
                    lastName: data.lastName || null,
                    phone: data.phone || null
                }
            }
        });

        if (error) throw error;
        return authData;
    },

    // Login with email OR username
    async login(usernameOrEmail: string, password: string) {
        let email = usernameOrEmail;

        // If not an email, look up email by username
        if (!usernameOrEmail.includes('@')) {
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('email')
                .eq('username', usernameOrEmail)
                .single();

            if (profileError || !profiles?.email) {
                throw new Error('Invalid credentials');
            }

            email = profiles.email;
        }

        // Login with email and password
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
                username: profileData.username, // keep username if provided
                first_name: profileData.first_name,
                last_name: profileData.last_name,
                phone: profileData.phone
            })
            .select()
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
