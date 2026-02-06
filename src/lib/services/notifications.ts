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
        console.log('Subscribing to Native Push (FCM)');

        // 1. Request Permission
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== 'granted') {
            throw new Error('User denied push permissions');
        }

        // 2. Register
        await PushNotifications.register();

        // 3. Listen for Token (Promise wrapper or global listener setup?)
        // Since register() is void and triggers a listener, we need to handle this carefully.
        // For simplicity in this call, we'll set up the listener to save to DB.

        // Note: Ideally this listener is set up once at app launch, but we can do it here to capture the token.
        return new Promise((resolve, reject) => {
            PushNotifications.addListener('registration', async (token) => {
                console.log('FCM Token:', token.value);
                const user = get(currentUser);
                if (user) {
                    // We save it as a "string" or a specific "native" object structure
                    // The DB column is JSON, so we can store { type: 'android', token: token.value }
                    const { error } = await supabase
                        .from('profiles')
                        .update({ push_subscription: { type: 'android', token: token.value } as any })
                        .eq('id', user.id);
                    if (error) console.error('Error saving FCM token', error);
                }
                resolve(token);
            });

            PushNotifications.addListener('registrationError', (error) => {
                reject(error);
            });
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

        const res = await fetch(`https://ryrwlkbzyldzbscvcqjh.supabase.co/functions/v1/send-push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Assuming RLS/Auth is handled via header in future, but for now passing user_id body as per function
            },
            body: JSON.stringify({
                user_id: user.id,
                title: 'Test Notification',
                body: 'If you see this, Web Push is working! 🐾',
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
