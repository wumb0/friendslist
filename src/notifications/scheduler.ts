import * as Notifications from 'expo-notifications';
import { Group } from '../types/Group';
import { Friend } from '../types/Friend';
import { sortFriends } from '../utils/sortFriends';

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

export async function scheduleGroupReminders(groups: Group[], friends: Friend[]): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const group of groups) {
      if (group.notificationFrequency === 'off') continue;
      const groupFriends = sortFriends(friends.filter(f => f.groupId === group.id));
      if (groupFriends.length === 0) continue;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Time to reach out',
          body: `You haven't checked in with ${groupFriends[0].name} in a while.`,
        },
        trigger:
          group.notificationFrequency === 'weekly'
            ? {
                type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                weekday: 2,
                hour: group.notificationHour,
                minute: group.notificationMinute,
              }
            : {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour: group.notificationHour,
                minute: group.notificationMinute,
              },
      });
    }
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
