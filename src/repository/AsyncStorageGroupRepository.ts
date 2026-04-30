import AsyncStorage from '@react-native-async-storage/async-storage';
import { Group, Schedule, ScheduleFrequency } from '../types/Group';
import { GroupRepository } from './GroupRepository';
import { generateId } from '../utils/uuid';

const STORAGE_KEY = 'groups_v1';

function migrateGroup(g: any): Group {
  if (Array.isArray(g.schedules)) {
    return { significantDatesEnabled: true, ...g } as Group;
  }
  // legacy flat-field shape
  const freq: string = g.notificationFrequency ?? 'off';
  const schedules: Schedule[] = freq === 'off' ? [] : [{
    id: generateId(),
    frequency: freq as ScheduleFrequency,
    hour: g.notificationHour ?? 9,
    minute: g.notificationMinute ?? 0,
    weekday: g.notificationWeekday,
    day: g.notificationDay,
  }];
  return {
    id: g.id,
    name: g.name,
    schedules,
    significantDatesEnabled: g.significantDatesEnabled ?? true,
  };
}

export class AsyncStorageGroupRepository implements GroupRepository {
  async getAll(): Promise<Group[]> {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) return [];
    return (JSON.parse(json) as any[]).map(migrateGroup);
  }

  private async saveAll(groups: Group[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  }

  async save(group: Group): Promise<void> {
    const groups = await this.getAll();
    const idx = groups.findIndex(g => g.id === group.id);
    if (idx >= 0) groups[idx] = group;
    else groups.push(group);
    await this.saveAll(groups);
  }

  async delete(id: string): Promise<void> {
    const groups = await this.getAll();
    await this.saveAll(groups.filter(g => g.id !== id));
  }
}
