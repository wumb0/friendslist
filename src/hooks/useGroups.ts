import { useState, useEffect, useCallback, useRef } from 'react';
import { Friend } from '../types/Friend';
import { Group, GroupFrequency } from '../types/Group';
import { GroupRepository } from '../repository/GroupRepository';
import { AsyncStorageGroupRepository } from '../repository/AsyncStorageGroupRepository';
import { scheduleGroupReminders, cancelAllReminders } from '../notifications/scheduler';
import { useTheme } from '../context/ThemeContext';
import { generateId } from '../utils/uuid';

const repo: GroupRepository = new AsyncStorageGroupRepository();

export function useGroups(friends: Friend[]) {
  const { settings } = useTheme();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const all = await repo.getAll();
    setGroups(all);
    return all;
  }, []);

  useEffect(() => { reload().finally(() => setLoading(false)); }, [reload]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (!settings.remindersEnabled) {
      cancelAllReminders();
    } else {
      scheduleGroupReminders(groups, friends);
    }
  }, [groups, friends, settings.remindersEnabled]);

  const addGroup = async (name: string, notificationFrequency: GroupFrequency, notificationHour: number, notificationMinute: number): Promise<Group> => {
    const group: Group = { id: generateId(), name: name.trim(), notificationFrequency, notificationHour, notificationMinute };
    await repo.save(group);
    await reload();
    return group;
  };

  const updateGroup = async (id: string, updates: Partial<Omit<Group, 'id'>>): Promise<void> => {
    const all = await repo.getAll();
    const group = all.find(g => g.id === id);
    if (!group) return;
    await repo.save({ ...group, ...updates });
    await reload();
  };

  const deleteGroup = async (id: string): Promise<void> => {
    await repo.delete(id);
    await reload();
  };

  return { groups, loading, addGroup, updateGroup, deleteGroup };
}
