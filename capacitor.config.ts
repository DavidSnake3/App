import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.finanzas.personal',
  appName: 'Finanzas Personales',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      iconColor: '#6366f1',
    },
  },
}

export default config
