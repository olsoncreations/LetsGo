import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.olsoncreations.letsgo',
  appName: 'LetsGo',
  webDir: 'out',
  server: {
    url: 'https://www.useletsgo.com',
    cleartext: false,
  },
  android: {
    backgroundColor: '#000000',
    allowMixedContent: false,
  },
};

export default config;
