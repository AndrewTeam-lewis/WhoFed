/**
 * Application Configuration
 *
 * Reads environment-specific variables from Vite's import.meta.env.
 * Environment is set by .env.development, .env.qa, or .env.production files.
 */

import { browser } from '$app/environment';

type Environment = 'development' | 'qa' | 'production';

// Read environment from Vite (set by .env files or build scripts)
const ENV = (import.meta.env.VITE_APP_ENV || 'development') as Environment;

// Export environment information
export const currentEnvironment = ENV;
export const isDevelopment = ENV === 'development';
export const isQA = ENV === 'qa';
export const isProduction = ENV === 'production';

// Export configuration from environment variables
export const APP_URL = import.meta.env.VITE_APP_URL || 'http://localhost:5173';
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'WhoFed';
export const BUNDLE_ID = import.meta.env.VITE_BUNDLE_ID || 'com.whofed.me';

// Supabase configuration (already read from .env in supabase.ts, but exported here for reference)
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Log current environment (only in browser, not during SSR)
if (browser && isDevelopment) {
  console.log('🚀 Running in', ENV.toUpperCase(), 'environment');
  console.log('📍 App URL:', APP_URL);
  console.log('📦 Bundle ID:', BUNDLE_ID);
}
