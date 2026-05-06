import { useEffect } from 'react'
import { useFinanceStore } from '../store/useFinanceStore'
import {
  getNotificationPermission,
  requestNotificationPermission,
  scheduleNotifications,
  cancelAllNotifications,
  restoreScheduledNotifications,
} from '../lib/notifications'

export function useNotifications() {
  const months = useFinanceStore((s) => s.months)
  const settings = useFinanceStore((s) => s.settings)
  const updateSettings = useFinanceStore((s) => s.updateSettings)

  useEffect(() => {
    restoreScheduledNotifications()
  }, [])

  useEffect(() => {
    if (settings.notificationsEnabled) {
      scheduleNotifications(months, settings)
    } else {
      cancelAllNotifications()
    }
  }, [months, settings])

  async function enableNotifications(): Promise<boolean> {
    const granted = await requestNotificationPermission()
    if (granted) updateSettings({ notificationsEnabled: true })
    return granted
  }

  function disableNotifications() {
    cancelAllNotifications()
    updateSettings({ notificationsEnabled: false })
  }

  return {
    permission: getNotificationPermission(),
    notificationsEnabled: settings.notificationsEnabled,
    enableNotifications,
    disableNotifications,
  }
}
