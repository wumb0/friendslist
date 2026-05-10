import { useState, useEffect, useCallback } from 'react';
import { Friend, FriendNote, SignificantDate, OneTimeEvent } from '../types/Friend';
import { FriendRepository } from '../repository/FriendRepository';
import { AsyncStorageFriendRepository } from '../repository/AsyncStorageFriendRepository';
import { sortFriends } from '../utils/sortFriends';
import { generateId } from '../utils/uuid';
import { dismissNotificationsForFriend } from '../notifications/scheduler';

const repo: FriendRepository = new AsyncStorageFriendRepository();

export function useFriends() {
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

  const addFriends = async (
    imports: Array<{ name: string; birthday?: { month: number; day: number; year?: number } }>,
    groupId: string,
  ): Promise<void> => {
    if (!groupId) return;
    for (const { name, birthday } of imports) {
      const significantDates: SignificantDate[] = birthday
        ? [{ id: generateId(), label: 'Birthday', month: birthday.month, day: birthday.day, year: birthday.year, notifyEnabled: true, notifyHour: 9, notifyMinute: 0 }]
        : [];
      await repo.save({ id: generateId(), name: name.trim(), groupId, lastCheckedIn: null, createdAt: Date.now(), notes: [], checkIns: [], significantDates, oneTimeEvents: [] });
    }
    await reload();
  };

  const checkIn = async (id: string): Promise<void> => {
    await repo.checkIn(id, Date.now());
    await reload();
    dismissNotificationsForFriend(id);
  };

  const addNote = async (friendId: string, content: string): Promise<void> => {
    const note: FriendNote = { id: generateId(), content: content.trim(), createdAt: Date.now() };
    await repo.addNote(friendId, note);
    await reload();
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
    await reload();
  };

  const convertCheckInToNote = async (friendId: string, checkInTs: number, content: string): Promise<void> => {
    await repo.convertCheckInToNote(friendId, checkInTs, content);
    await reload();
  };

  const renameFriend = async (id: string, name: string): Promise<void> => {
    const all = await repo.getAll();
    const friend = all.find(f => f.id === id);
    if (!friend) return;
    await repo.save({ ...friend, name: name.trim() });
    await reload();
  };

  const moveToGroup = async (friendId: string, groupId: string): Promise<void> => {
    const all = await repo.getAll();
    const friend = all.find(f => f.id === friendId);
    if (!friend) return;
    await repo.save({ ...friend, groupId });
    await reload();
  };

  const moveGroupMembers = async (fromGroupId: string, toGroupId: string): Promise<void> => {
    const all = await repo.getAll();
    for (const friend of all.filter(f => f.groupId === fromGroupId)) {
      await repo.save({ ...friend, groupId: toGroupId });
    }
    await reload();
  };

  const addSignificantDate = async (friendId: string, data: Omit<SignificantDate, 'id'>): Promise<void> => {
    await repo.addSignificantDate(friendId, { ...data, id: generateId() });
    await reload();
  };

  const updateSignificantDate = async (friendId: string, dateId: string, updates: Partial<Omit<SignificantDate, 'id'>>): Promise<void> => {
    await repo.updateSignificantDate(friendId, dateId, updates);
    await reload();
  };

  const deleteSignificantDate = async (friendId: string, dateId: string): Promise<void> => {
    await repo.deleteSignificantDate(friendId, dateId);
    await reload();
  };

  const addOneTimeEvent = async (friendId: string, data: Omit<OneTimeEvent, 'id'>): Promise<void> => {
    await repo.addOneTimeEvent(friendId, { ...data, id: generateId() });
    await reload();
  };

  const updateOneTimeEvent = async (friendId: string, eventId: string, updates: Partial<Omit<OneTimeEvent, 'id'>>): Promise<void> => {
    await repo.updateOneTimeEvent(friendId, eventId, updates);
    await reload();
  };

  const deleteOneTimeEvent = async (friendId: string, eventId: string): Promise<void> => {
    await repo.deleteOneTimeEvent(friendId, eventId);
    await reload();
  };

  return {
    friends, loading,
    addFriends, checkIn, addNote, updateNote, deleteNote, deleteFriend,
    convertCheckInToNote, moveToGroup, moveGroupMembers, renameFriend,
    addSignificantDate, updateSignificantDate, deleteSignificantDate,
    addOneTimeEvent, updateOneTimeEvent, deleteOneTimeEvent,
  };
}
