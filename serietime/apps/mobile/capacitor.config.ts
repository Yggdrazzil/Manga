import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.serietime.app',
  appName: 'SerieTime',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
