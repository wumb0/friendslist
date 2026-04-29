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
          data: { friendId: groupFriends[0].id, groupId: group.id },
        },
        trigger:
          group.notificationFrequency === 'weekly'
            ? {
                type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                weekday: group.notificationWeekday ?? 2,
                hour: group.notificationHour,
                minute: group.notificationMinute,
              }
            : group.notificationFrequency === 'monthly'
            ? {
                type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
                day: group.notificationDay ?? 1,
                hour: group.notificationHour,
                minute: group.notificationMinute,
                repeats: true,
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

type NotificationTarget = { friendId: string; groupId: string };

function extractTarget(response: Notifications.NotificationResponse): NotificationTarget | null {
  const data = response.notification.request.content.data as Record<string, unknown>;
  if (typeof data.friendId === 'string' && typeof data.groupId === 'string') {
    return { friendId: data.friendId, groupId: data.groupId };
  }
  return null;
}

export function addNotificationTapListener(handler: (target: NotificationTarget) => void): { remove: () => void } {
  try {
    return Notifications.addNotificationResponseReceivedListener(response => {
      const target = extractTarget(response);
      if (target) handler(target);
    });
  } catch {
    return { remove: () => {} };
  }
}

export async function getInitialNotificationTarget(): Promise<NotificationTarget | null> {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    return response ? extractTarget(response) : null;
  } catch {
    return null;
  }
}

export async function cancelAllReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // no-op
  }
}
