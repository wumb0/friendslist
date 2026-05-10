import * as Notifications from 'expo-notifications';
import { Group, Schedule } from '../types/Group';
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

// Returns the most recent past fire time for a non-daily schedule, or null for daily.
function getLastFireTime(schedule: Schedule, now: Date): Date | null {
  if (schedule.frequency === 'daily') return null;

  const candidate = new Date(now);

  if (schedule.frequency === 'weekly') {
    const schedDow = (schedule.weekday ?? 2) - 1; // 1=Sun…7=Sat → 0=Sun…6=Sat
    const daysBack = (now.getDay() - schedDow + 7) % 7;
    candidate.setDate(candidate.getDate() - daysBack);
    candidate.setHours(schedule.hour, schedule.minute, 0, 0);
    if (candidate >= now) candidate.setDate(candidate.getDate() - 7);
    return candidate;
  }

  if (schedule.frequency === 'monthly') {
    const day = schedule.day ?? 1;
    candidate.setDate(day);
    candidate.setHours(schedule.hour, schedule.minute, 0, 0);
    if (candidate >= now) {
      candidate.setMonth(candidate.getMonth() - 1);
      candidate.setDate(day);
      candidate.setHours(schedule.hour, schedule.minute, 0, 0);
    }
    return candidate;
  }

  return null;
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
      const groupFriends = sortFriends(friends.filter(f => f.groupId === group.id));
      if (groupFriends.length === 0) continue;
      const topFriend = groupFriends[0];
      for (const schedule of group.schedules) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Time to reach out',
            body: `${topFriend.name} hasn't heard from you in a while.`,
            data: { groupId: group.id, friendId: topFriend.id },
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

    // Pass 4 — missed check-in follow-ups (weekly and monthly schedules only)
    // Cancellation is automatic: refreshScheduledNotifications is called on every check-in,
    // so if the user checked in after the last fire time this pass simply skips scheduling.
    for (const group of groups) {
      const groupFriends = sortFriends(friends.filter(f => f.groupId === group.id));
      if (groupFriends.length === 0) continue;
      for (const schedule of group.schedules) {
        const lastFireTime = getLastFireTime(schedule, now);
        if (!lastFireTime) continue;
        const followUpTime = new Date(lastFireTime.getTime() + 24 * 60 * 60 * 1000);
        if (followUpTime <= now) continue; // window has passed
        const anyCheckedIn = groupFriends.some(
          f => f.lastCheckedIn !== null && f.lastCheckedIn > lastFireTime.getTime(),
        );
        if (anyCheckedIn) continue;
        const topFriend = groupFriends[0];
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Still haven\'t reached out',
            body: `${topFriend.name} is still waiting to hear from you.`,
            data: { groupId: group.id, friendId: topFriend.id },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: followUpTime,
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

export async function dismissNotificationsForFriend(friendId: string): Promise<void> {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const notification of presented) {
      const data = notification.request.content.data as Record<string, unknown>;
      if (data.friendId === friendId) {
        await Notifications.dismissNotificationAsync(notification.request.identifier);
      }
    }
  } catch {
    // no-op
  }
}
