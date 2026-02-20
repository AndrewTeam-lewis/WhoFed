import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type TooltipId = 'add-family' | 'members-role' | 'onetime-task' | null;

type OnboardingState = {
    showWelcome: boolean;
    activeTooltip: TooltipId;
};

const STORAGE_KEY = 'whofed_welcome_seen';

function createOnboardingStore() {
    const { subscribe, update, set } = writable<OnboardingState>({
        showWelcome: false,
        activeTooltip: null
    });

    return {
        subscribe,
        // Trigger Welcome Modal (if not seen)
        checkWelcome: () => {
            if (browser && !localStorage.getItem(STORAGE_KEY)) {
                update(s => ({ ...s, showWelcome: true }));
            }
        },
        // Force show (e.g. "Show me around" button)
        showWelcome: () => {
            update(s => ({ ...s, showWelcome: true }));
        },
        // Dismiss Welcome
        dismissWelcome: () => {
            if (browser) localStorage.setItem(STORAGE_KEY, 'true');
            update(s => ({ ...s, showWelcome: false }));
        },
        // Tooltip Logic
        showTooltip: (id: TooltipId) => {
            update(s => ({ ...s, activeTooltip: id }));
        },
        hideTooltip: () => {
            update(s => ({ ...s, activeTooltip: null }));
        }
    };
}

export const onboarding = createOnboardingStore();
