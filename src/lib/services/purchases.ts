import { Purchases, LOG_LEVEL, type PurchasesPackage, type CustomerInfo } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';
import { writable } from 'svelte/store';
import { userIsPremium } from '$lib/stores/user';

// REVENUECAT PUBLIC API KEY
const API_KEY = 'goog_icLHxgLbQOtvYjLAyOYoNlpoAYN';

// Store to track native entitlement status locally (instant update)
export const nativePremiumStatus = writable(false);
export const currentOfferings = writable<PurchasesPackage[]>([]);

export const purchasesService = {
    async init() {
        if (!Capacitor.isNativePlatform()) {
            console.log('Purchases: Web platform detected, skipping init');
            return;
        }

        try {
            console.log('Purchases: Initializing...');
            await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
            await Purchases.configure({ apiKey: API_KEY });

            // Check initial entitlement
            await this.updateEntitlementStatus();

            // Load offerings (products to buy)
            await this.loadOfferings();

            // Listen for changes (e.g. external subscription update)
            Purchases.addCustomerInfoUpdateListener((info) => {
                this.handleCustomerInfo(info);
            });

        } catch (e) {
            console.error('Purchases: Init failed', e);
        }
    },

    async login(userId: string) {
        if (!Capacitor.isNativePlatform()) return;
        try {
            console.log('Purchases: Logging in as', userId);
            const { customerInfo } = await Purchases.logIn({ appUserID: userId });
            this.handleCustomerInfo(customerInfo);
        } catch (e) {
            console.error('Purchases: Login failed', e);
        }
    },

    async logout() {
        if (!Capacitor.isNativePlatform()) return;
        try {
            await Purchases.logOut();
            nativePremiumStatus.set(false);
        } catch (e) {
            console.error('Purchases: Logout failed', e);
        }
    },

    async loadOfferings() {
        if (!Capacitor.isNativePlatform()) return;
        try {
            const offerings = await Purchases.getOfferings();
            if (offerings.current && offerings.current.availablePackages.length > 0) {
                currentOfferings.set(offerings.current.availablePackages);
            }
        } catch (e) {
            console.error('Purchases: Failed to load offerings', e);
        }
    },

    async purchase(pkg: PurchasesPackage) {
        if (!Capacitor.isNativePlatform()) {
            alert("Purchases are only available on the mobile app.");
            return;
        }

        try {
            const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
            this.handleCustomerInfo(customerInfo);
            return true; // Success
        } catch (e: any) {
            if (e.userCancelled) {
                console.log('User cancelled purchase');
                return false;
            }
            console.error('Purchase failed:', e);
            throw e;
        }
    },

    async restorePurchases() {
        if (!Capacitor.isNativePlatform()) return;
        try {
            const { customerInfo } = await Purchases.restorePurchases();
            this.handleCustomerInfo(customerInfo);
            alert('Purchases restored!');
        } catch (e: any) {
            alert('Restore failed: ' + e.message);
        }
    },

    async updateEntitlementStatus() {
        if (!Capacitor.isNativePlatform()) return;
        try {
            const { customerInfo } = await Purchases.getCustomerInfo();
            this.handleCustomerInfo(customerInfo);
        } catch (e) {
            console.error('Purchases: getCustomerInfo failed', e);
        }
    },

    handleCustomerInfo(info: CustomerInfo) {
        // ENTITLEMENT ID: 'premium' (This must match what you create in RevenueCat Dashboard)
        const isPremium = info.entitlements.active['premium'] !== undefined;
        console.log('Purchases: Premium Status:', isPremium);
        nativePremiumStatus.set(isPremium);
    }
};
