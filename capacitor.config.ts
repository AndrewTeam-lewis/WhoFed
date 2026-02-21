import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.whofed.me',
  appName: 'WhoFed',
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
