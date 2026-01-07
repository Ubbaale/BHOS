import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.carehubapp.app',
  appName: 'Carehub',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    hostname: 'carehubapp.com'
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'Carehub'
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: '#1e40af',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#1e40af',
      overlaysWebView: false
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    }
  }
};

export default config;
