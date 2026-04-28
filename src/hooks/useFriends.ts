import { useState, useEffect, useCallback, useRef } from 'react';
import { Friend, FriendNote } from '../types/Friend';
import { FriendRepository } from '../repository/FriendRepository';
import { AsyncStorageFriendRepository } from '../repository/AsyncStorageFriendRepository';
import { sortFriends } from '../utils/sortFriends';
import { generateId } from '../utils/uuid';
import { scheduleReminder, cancelAllReminders } from '../notifications/scheduler';
import { AppSettings, NotificationFrequency } from '../context/ThemeContext';

const repo: FriendRepository = new AsyncStorageFriendRepository();

type NotifSettings = Pick<AppSettings, 'notificationFrequency' | 'notificationHour' | 'notificationMinute'>;

export function useFriends(notif: NotifSettings) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const all = await repo.getAll();
    const sorted = sortFriends(all);
    setFriends(sorted);
    return sorted;
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  const refreshNotification = async (sorted: Friend[], frequency: NotificationFrequency, hour: number, minute: number) => {
    if (sorted.length === 0 || frequency === 'off') {
      await cancelAllReminders();
    } else {
      await scheduleReminder(sorted[0].name, frequency, hour, minute);
    }
  };

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    repo.getAll().then(all => {
      const sorted = sortFriends(all);
      refreshNotification(sorted, notif.notificationFrequency, notif.notificationHour, notif.notificationMinute);
    });
  }, [notif.notificationFrequency, notif.notificationHour, notif.notificationMinute]);

  const addFriends = async (names: string[]): Promise<void> => {
    for (const name of names) {
      await repo.save({ id: generateId(), name: name.trim(), lastCheckedIn: null, createdAt: Date.now(), notes: [], checkIns: [] });
    }
    const sorted = await reload();
    await refreshNotification(sorted, notif.notificationFrequency, notif.notificationHour, notif.notificationMinute);
  };

  const checkIn = async (id: string): Promise<void> => {
    await repo.checkIn(id, Date.now());
    const sorted = await reload();
    await refreshNotification(sorted, notif.notificationFrequency, notif.notificationHour, notif.notificationMinute);
  };

  const addNote = async (friendId: string, content: string): Promise<void> => {
    const note: FriendNote = { id: generateId(), content: content.trim(), createdAt: Date.now() };
    await repo.addNote(friendId, note); // also updates lastCheckedIn
    const sorted = await reload();
    await refreshNotification(sorted, notif.notificationFrequency, notif.notificationHour, notif.notificationMinute);
  };

  const updateNote = async (
    friendId: string,
    noteId: string,
    updates: Partial<Pick<FriendNote, 'content' | 'pinned'>>,
  ): Promise<void> => {
    await repo.updateNote(friendId, noteId, updates);
    await reload();
  };

  const deleteNote = async (friendId: string, noteId: string): Promise<void> => {
    await repo.deleteNote(friendId, noteId);
    await reload();
  };

  const deleteFriend = async (id: string): Promise<void> => {
    await repo.delete(id);
    const sorted = await reload();
    await refreshNotification(sorted, notif.notificationFrequency, notif.notificationHour, notif.notificationMinute);
  };

  const convertCheckInToNote = async (friendId: string, checkInTs: number, content: string): Promise<void> => {
    await repo.convertCheckInToNote(friendId, checkInTs, content);
    await reload();
  };

  return { friends, loading, addFriends, checkIn, addNote, updateNote, deleteNote, deleteFriend, convertCheckInToNote };
}
