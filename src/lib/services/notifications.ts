import { supabase } from '$lib/supabase';
import { currentUser } from '$lib/stores/user';
import { get } from 'svelte/store';

const VAPID_PUBLIC_KEY = 'BKgU7auEtbT1TI3WDNYygc2tGnOzgQ92JMAXvm4zuX7lgwibL747ltF4nifFtMpCJkqghlWVA9BoSaBLPAoUAHo';

export const notificationService = {
    async subscribeToPush() {
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
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();

            // Clear from DB
            const user = get(currentUser);
            if (user) {
                await supabase
                    .from('profiles')
                    .update({ push_subscription: null })
                    .eq('id', user.id);
            }
        }
    },

    async checkSubscriptionState(): Promise<boolean> {
        if (!('serviceWorker' in navigator)) return false;
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        return !!subscription;
    },

    async sendTestNotification() {
        // Send a request to the edge function with our ID
        const user = get(currentUser);
        if (!user) throw new Error("Must be logged in");

        await fetch(`https://ryrwlkbzyldzbscvcqjh.supabase.co/functions/v1/send-push`, {
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
