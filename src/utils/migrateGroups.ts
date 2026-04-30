import AsyncStorage from '@react-native-async-storage/async-storage';
import { Group, Schedule } from '../types/Group';
import { generateId } from './uuid';

export async function migrateGroups(): Promise<void> {
  const groupsJson = await AsyncStorage.getItem('groups_v1');

  if (!groupsJson) {
    // First-time migration: build default group from old global notification settings
    const settingsJson = await AsyncStorage.getItem('app_settings_v1');
    const rawSettings = settingsJson ? JSON.parse(settingsJson) : {};

    const freq: string = rawSettings.notificationFrequency ?? 'daily';
    let schedules: Schedule[] = [];
    if (freq !== 'off') {
      schedules = [{
        id: generateId(),
        frequency: freq === 'monthly' ? 'monthly' : freq === 'weekly' ? 'weekly' : 'daily',
        hour: rawSettings.notificationHour ?? 9,
        minute: rawSettings.notificationMinute ?? 0,
        weekday: rawSettings.notificationWeekday,
        day: rawSettings.notificationDay,
      }];
    }

    const defaultGroup: Group = {
      id: generateId(),
      name: 'Friends',
      schedules,
      significantDatesEnabled: true,
    };

    await AsyncStorage.setItem('groups_v1', JSON.stringify([defaultGroup]));

    // Strip notification fields; they now live on Group
    const {
      notificationFrequency: _f,
      notificationHour: _h,
      notificationMinute: _m,
      notificationWeekday: _wd,
      notificationDay: _d,
      ...rest
    } = rawSettings;
    await AsyncStorage.setItem('app_settings_v1', JSON.stringify(rest));
  }

  // Always: assign any friends missing a groupId to the first group (handles partial failures)
  const currentGroupsJson = await AsyncStorage.getItem('groups_v1');
  const groups: Group[] = currentGroupsJson ? JSON.parse(currentGroupsJson) : [];
  const firstGroupId = groups[0]?.id;
  if (firstGroupId) {
    const friendsJson = await AsyncStorage.getItem('friends_v1');
    if (friendsJson) {
      const friends = JSON.parse(friendsJson);
      if (friends.some((f: any) => !f.groupId)) {
        await AsyncStorage.setItem(
          'friends_v1',
          JSON.stringify(friends.map((f: any) => ({ ...f, groupId: f.groupId ?? firstGroupId }))),
        );
      }
    }
  }
}
