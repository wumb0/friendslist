import * as Notifications from 'expo-notifications';
import { Group } from '../types/Group';
import { Friend } from '../types/Friend';

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

function eventWhenString(notifyDaysBefore: number): string {
  if (notifyDaysBefore === 0) return 'today';
  if (notifyDaysBefore === 1) return 'tomorrow';
  if (notifyDaysBefore === 7) return 'next week';
  return `in ${notifyDaysBefore} days`;
}

export async function refreshScheduledNotifications(groups: Group[], friends: Friend[], remindersEnabled: boolean): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!remindersEnabled) return;

    const now = new Date();

    // Pass 1 — group schedules (repeating triggers, 1 slot each)
    for (const group of groups) {
      if (group.schedules.length === 0) continue;
      if (friends.filter(f => f.groupId === group.id).length === 0) continue;
      for (const schedule of group.schedules) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Time to reach out',
            body: `Time to check in with your ${group.name} group.`,
            data: { groupId: group.id },
          },
          trigger:
            schedule.frequency === 'weekly'
              ? {
                  type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                  weekday: schedule.weekday ?? 2,
                  hour: schedule.hour,
                  minute: schedule.minute,
                }
              : schedule.frequency === 'monthly'
              ? {
                  type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
                  day: schedule.day ?? 1,
                  hour: schedule.hour,
                  minute: schedule.minute,
                  repeats: true,
                }
              : {
                  type: Notifications.SchedulableTriggerInputTypes.DAILY,
                  hour: schedule.hour,
                  minute: schedule.minute,
                },
        });
      }
    }

    // Pass 2 — significant dates (YEARLY repeating triggers, 1 slot each)
    for (const friend of friends) {
      const group = groups.find(g => g.id === friend.groupId);
      if (!(group?.significantDatesEnabled ?? true)) continue;
      for (const date of friend.significantDates) {
        if (!date.notifyEnabled) continue;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `${friend.name}'s ${date.label}`,
            body: "Don't forget to reach out today!",
            data: { friendId: friend.id, groupId: friend.groupId },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.YEARLY,
            month: date.month,
            day: date.day,
            hour: date.notifyHour,
            minute: date.notifyMinute,
          },
        });
      }
    }

    // Pass 3 — one-time events (DATE one-shot triggers)
    for (const friend of friends) {
      for (const event of friend.oneTimeEvents) {
        if (!event.notifyEnabled) continue;
        const d = new Date(event.eventDate);
        d.setHours(0, 0, 0, 0);
        const fireTime = new Date(d.getTime() - event.notifyDaysBefore * 86400000);
        fireTime.setHours(event.notifyHour, event.notifyMinute, 0, 0);
        if (fireTime <= now) continue;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `${friend.name}'s ${event.label} is ${eventWhenString(event.notifyDaysBefore)}`,
            body: "Don't forget to reach out.",
            data: { friendId: friend.id, groupId: friend.groupId },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fireTime,
          },
        });
      }
    }
  } catch {
    // not supported in this environment
  }
}

type NotificationTarget = { friendId?: string; groupId: string };

function extractTarget(response: Notifications.NotificationResponse): NotificationTarget | null {
  const data = response.notification.request.content.data as Record<string, unknown>;
  if (typeof data.groupId === 'string') {
    return {
      groupId: data.groupId,
      friendId: typeof data.friendId === 'string' ? data.friendId : undefined,
    };
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
