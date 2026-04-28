import * as Notifications from 'expo-notifications';
import { NotificationFrequency } from '../context/ThemeContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function scheduleReminder(
  topFriendName: string,
  frequency: NotificationFrequency,
  hour: number = 9,
  minute: number = 0,
): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (frequency === 'off') return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time to reach out',
        body: `You haven't checked in with ${topFriendName} in a while.`,
      },
      trigger:
        frequency === 'weekly'
          ? {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              weekday: 2,
              hour,
              minute,
            }
          : {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour,
              minute,
            },
    });
  } catch {
    // not supported in this environment
  }
}

export async function cancelAllReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // no-op
  }
}
