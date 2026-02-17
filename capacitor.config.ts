import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.whofed.me',
  appName: 'WhoFed',
  webDir: 'build',
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
    }
  }
};

export default config;
