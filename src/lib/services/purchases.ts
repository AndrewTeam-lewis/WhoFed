import { Purchases, LOG_LEVEL, type PurchasesPackage, type CustomerInfo } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';
import { writable } from 'svelte/store';
import { supabase } from '$lib/supabase';

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
            await this.handleCustomerInfo(customerInfo);
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

    async runDiagnostics(): Promise<string[]> {
        const lines: string[] = [];
        const log = (msg: string) => { lines.push(msg); console.log('[RC Diag]', msg); };

        log(`Platform: ${Capacitor.getPlatform()}`);
        log(`Is native: ${Capacitor.isNativePlatform()}`);

        if (!Capacitor.isNativePlatform()) {
            log('SKIP: Not a native platform, RevenueCat is inactive.');
            return lines;
        }

        // 1. Check Supabase auth
        try {
            const { data: { user } } = await supabase.auth.getUser();
            log(`Supabase user: ${user ? user.id : 'NOT LOGGED IN'}`);
        } catch (e: any) {
            log(`Supabase auth error: ${e.message}`);
        }

        // 2. Get RevenueCat customer info
        try {
            const { customerInfo } = await Purchases.getCustomerInfo();
            log(`RC App User ID: ${customerInfo.originalAppUserId}`);
            log(`RC All Entitlements: ${JSON.stringify(Object.keys(customerInfo.entitlements.all))}`);
            log(`RC Active Entitlements: ${JSON.stringify(Object.keys(customerInfo.entitlements.active))}`);

            // Show details of each entitlement
            for (const [key, ent] of Object.entries(customerInfo.entitlements.all)) {
                log(`  Entitlement "${key}": isActive=${(ent as any).isActive}, productId=${(ent as any).productIdentifier}, expires=${(ent as any).expirationDate}`);
            }

            const isPremium = customerInfo.entitlements.active['premium'] !== undefined;
            log(`Check active['premium']: ${isPremium}`);
            if (!isPremium && Object.keys(customerInfo.entitlements.active).length > 0) {
                log(`WARNING: Active entitlements exist but none named 'premium'. Check RevenueCat dashboard entitlement ID!`);
            }
        } catch (e: any) {
            log(`RC getCustomerInfo failed: ${e.message}`);
        }

        // 3. Check offerings
        try {
            const offerings = await Purchases.getOfferings();
            if (offerings.current) {
                log(`Offerings: ${offerings.current.availablePackages.map(p => p.identifier).join(', ')}`);
            } else {
                log('Offerings: NONE (no current offering configured)');
            }
        } catch (e: any) {
            log(`RC getOfferings failed: ${e.message}`);
        }

        // 4. Test DB write
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('tier')
                    .eq('id', user.id)
                    .single();
                log(`DB current tier: ${data?.tier || 'NOT FOUND'}`);
                if (error) log(`DB read error: ${error.message}`);
            }
        } catch (e: any) {
            log(`DB test failed: ${e.message}`);
        }

        return lines;
    },

    async handleCustomerInfo(info: CustomerInfo) {
        // ENTITLEMENT ID: 'premium' (This must match what you create in RevenueCat Dashboard)
        const isPremium = info.entitlements.active['premium'] !== undefined;
        console.log('Purchases: Premium Status:', isPremium);
        nativePremiumStatus.set(isPremium);

        // Sync premium status to Supabase profiles.tier
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const newTier = isPremium ? 'premium' : 'free';
                const { error } = await supabase
                    .from('profiles')
                    .update({ tier: newTier })
                    .eq('id', user.id);
                if (error) {
                    console.error('Purchases: Failed to sync tier to DB:', error);
                } else {
                    console.log('Purchases: Synced tier to DB:', newTier);
                }
            }
        } catch (e) {
            console.error('Purchases: Error syncing tier to DB:', e);
        }
    }
};
