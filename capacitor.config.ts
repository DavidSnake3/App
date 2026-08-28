import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.finanzas.personal',
  appName: 'SNBusiness',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      iconColor: '#7c5cff',
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
}

export default config
