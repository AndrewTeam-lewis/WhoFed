import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { supabase } from '$lib/supabase';
import { currentUser } from '$lib/stores/user';
import en from '$lib/i18n/en';
import pt from '$lib/i18n/pt';

// 1. Define supported languages
export type Language = 'en' | 'pt';
const dictionaries = { en, pt };

// 2. Initialize Store
// Priority: Local Storage -> Browser Language -> Default 'en'
const storedLang = browser ? localStorage.getItem('whofed_lang') as Language : null;
const browserLang = browser && navigator.language.startsWith('pt') ? 'pt' : 'en';
const initialLang: Language = storedLang || browserLang || 'en';

export const currentLanguage = writable<Language>(initialLang);

export function setLanguage(lang: Language) {
    currentLanguage.set(lang);
}

// 3. Persist & Sync changes
if (browser) {
    currentLanguage.subscribe(lang => {
        localStorage.setItem('whofed_lang', lang);
        document.documentElement.lang = lang;

        // Sync to Profile if logged in
        const user = get(currentUser);
        if (user) {
            updateProfileLanguage(user.id, lang);
        }
    });
}

// Helper to update profile (debounce could be good but direct for now)
async function updateProfileLanguage(userId: string, lang: Language) {
    // Only update if different from what might be in DB? 
    // For simplicity, just update. RLS policies allow users to update their own profile.
    const { error } = await supabase.from('profiles').update({ language: lang }).eq('id', userId);
    if (error) console.error('Failed to sync language to profile:', error);
}

// 4. Translation Store ($t)
export const t = derived(currentLanguage, ($lang) => {
    return dictionaries[$lang] || dictionaries['en'];
});

// 5. Helper for dynamic replacement (optional, if needed for complex strings)
// Usage: replaceParams("Hello {name}", { name: "World" })
export function replaceParams(text: string, params: Record<string, string>) {
    let result = text;
    for (const key in params) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), params[key]);
    }
    return result;
}
