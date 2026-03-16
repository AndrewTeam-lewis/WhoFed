import { supabase } from '$lib/supabase';
import { currentUser } from '$lib/stores/user';
import { get } from 'svelte/store';

const VAPID_PUBLIC_KEY = 'BKgU7auEtbT1TI3WDNYygc2tGnOzgQ92JMAXvm4zuX7lgwibL747ltF4nifFtMpCJkqghlWVA9BoSaBLPAoUAHo';

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

export const notificationService = {
    async subscribeToPush() {
        if (Capacitor.isNativePlatform()) {
            return this.subscribeNative();
        } else {
            return this.subscribeWeb();
        }
    },

    async subscribeNative() {
        console.log('[Push] Subscribing to Native Push (FCM)');

        // 1. Request Permission
        let permStatus = await PushNotifications.checkPermissions();
        console.log('[Push] Current permission status:', permStatus.receive);
        if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
            console.log('[Push] Permission after request:', permStatus.receive);
        }
        if (permStatus.receive !== 'granted') {
            throw new Error('User denied push permissions');
        }

        // 2. Set up listener BEFORE register() to avoid missing the token
        await PushNotifications.removeAllListeners();

        return new Promise((resolve, reject) => {
            PushNotifications.addListener('registration', async (token) => {
                console.log('[Push] FCM Token received:', token.value.substring(0, 20) + '...');
                const user = get(currentUser);
                if (user) {
                    const { error } = await supabase
                        .from('profiles')
                        .update({ push_subscription: { type: 'android', token: token.value } as any })
                        .eq('id', user.id);
                    if (error) {
                        console.error('[Push] Error saving FCM token:', error);
                        reject(new Error('Failed to save push token'));
                        return;
                    }
                    console.log('[Push] FCM token saved to database');
                } else {
                    console.error('[Push] No user found, cannot save token');
                    reject(new Error('No user found'));
                    return;
                }
                resolve(token);
            });

            PushNotifications.addListener('registrationError', (error) => {
                console.error('[Push] Registration error:', error);
                reject(error);
            });

            // 3. Register AFTER listeners are ready
            console.log('[Push] Calling PushNotifications.register()...');
            PushNotifications.register();
        });
    },

    async subscribeWeb() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            throw new Error('Push notifications are not supported on this device.');
        }

        // 1. Register Service Worker
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        await navigator.serviceWorker.ready;

        // 2. Subscribe to Push Manager
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });

        // 3. Save to Supabase
        const user = get(currentUser);
        if (user) {
            const { error } = await supabase
                .from('profiles')
                .update({ push_subscription: subscription.toJSON() as any })
                .eq('id', user.id);

            if (error) throw error;
        }

        return subscription;
    },

    async unsubscribeFromPush() {
        if (Capacitor.isNativePlatform()) {
            // Native unsubscribe/unregister not always necessary, usually just disable logic
            // But we should clear the DB
        } else {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) await subscription.unsubscribe();
        }

        // Clear from DB
        const user = get(currentUser);
        if (user) {
            await supabase.from('profiles').update({ push_subscription: null }).eq('id', user.id);
        }
    },

    // Refresh FCM token on app launch (Firebase best practice)
    // Re-registers with FCM to catch any rotated tokens and updates the database
    async refreshTokenIfNeeded() {
        if (!Capacitor.isNativePlatform()) return;

        try {
            const permStatus = await PushNotifications.checkPermissions();
            if (permStatus.receive !== 'granted') return;

            const user = get(currentUser);
            if (!user) return;

            console.log('[Push] Refreshing FCM token on launch...');

            // Clear old listeners, set up new one, THEN register
            await PushNotifications.removeAllListeners();

            PushNotifications.addListener('registration', async (token) => {
                console.log('[Push] FCM token refreshed:', token.value.substring(0, 20) + '...');
                const { error } = await supabase
                    .from('profiles')
                    .update({ push_subscription: { type: 'android', token: token.value } as any })
                    .eq('id', user.id);
                if (error) console.error('[Push] Error updating FCM token:', error);
                else console.log('[Push] FCM token updated in database');
            });

            PushNotifications.addListener('registrationError', (error) => {
                console.error('[Push] Token refresh registration error:', error);
            });

            await PushNotifications.register();
        } catch (e) {
            console.error('[Push] Token refresh failed:', e);
        }
    },

    async checkSubscriptionState(): Promise<boolean> {
        if (Capacitor.isNativePlatform()) {
            const perm = await PushNotifications.checkPermissions();
            return perm.receive === 'granted';
        }

        if (!('serviceWorker' in navigator)) return false;
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        return !!subscription;
    },

    async sendTestNotification() {
        // Send a request to the edge function with our ID
        const user = get(currentUser);
        if (!user) throw new Error("Must be logged in");

        // Use environment-specific Edge Function URL and anon key
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ryrwlkbzyldzbscvcqjh.supabase.co';
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-push`;

        const res = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': anonKey,
                'Authorization': `Bearer ${anonKey}`
            },
            body: JSON.stringify({
                user_id: user.id,
                title: 'Test Notification',
                body: 'If you see this, Web Push is working!',
                url: '/settings'
            })
        });

        const data = await res.json();
        if (!res.ok) {
            alert('Push Error: ' + (data.error || 'Unknown Error'));
            console.error('Push Failed:', data);
        } else {
            alert('Push Sent! Server says: ' + JSON.stringify(data));
        }
    },

    // Utility to convert VAPID key
    urlBase64ToUint8Array(base64String: string) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
};
