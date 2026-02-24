import type { CapacitorConfig } from '@capacitor/cli';

// Determine environment-specific values based on NODE_ENV
// The build scripts set NODE_ENV before calling npx cap sync
const isDev = process.env.NODE_ENV === 'development';
const isQA = process.env.NODE_ENV === 'qa';
const isProd = process.env.NODE_ENV === 'production';

// Set bundle ID and app name based on environment
let bundleId = 'com.whofed.me';
let appName = 'WhoFed';

if (isDev) {
  bundleId = 'com.whofed.dev';
  appName = 'WhoFed Dev';
} else if (isQA) {
  bundleId = 'com.whofed.qa';
  appName = 'WhoFed (QA)';
}

const config: CapacitorConfig = {
  appId: bundleId,
  appName: appName,
  webDir: 'build',
  // Deep linking configuration
  server: {
    url: undefined,
    cleartext: true,
    androidScheme: 'https'
  },
  plugins: {
    StatusBar: {
      style: 'Light',
      backgroundColor: '#FFFFFF',
      overlaysWebView: false
    },
    NavigationBar: {
      color: '#FFFFFF',
      buttons: 'dark'
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    // Custom URL scheme for deep linking
    AppUrlOpen: {
      customScheme: 'whofed'
    }
  }
};

export default config;
