import AsyncStorage from '@react-native-async-storage/async-storage';
import { Group } from '../types/Group';
import { GroupRepository } from './GroupRepository';

const STORAGE_KEY = 'groups_v1';

export class AsyncStorageGroupRepository implements GroupRepository {
  async getAll(): Promise<Group[]> {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) return [];
    return (JSON.parse(json) as any[]).map(g => ({
      significantDatesEnabled: true,
      ...g,
    })) as Group[];
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
