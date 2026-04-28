import AsyncStorage from '@react-native-async-storage/async-storage';
import { Friend, FriendNote } from '../types/Friend';
import { FriendRepository } from './FriendRepository';
import { generateId } from '../utils/uuid';

const STORAGE_KEY = 'friends_v1';

function migrate(raw: any): Friend {
  let notes: FriendNote[] = [];
  if (typeof raw.notes === 'string') {
    if (raw.notes.trim()) {
      notes = [{ id: generateId(), content: raw.notes.trim(), createdAt: raw.createdAt ?? Date.now() }];
    }
  } else if (Array.isArray(raw.notes)) {
    notes = raw.notes;
  }
  return {
    ...raw,
    notes,
    checkIns: Array.isArray(raw.checkIns) ? raw.checkIns : [],
  };
}

export class AsyncStorageFriendRepository implements FriendRepository {
  async getAll(): Promise<Friend[]> {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) return [];
    return (JSON.parse(json) as any[]).map(migrate);
  }

  private async saveAll(friends: Friend[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(friends));
  }

  async save(friend: Friend): Promise<void> {
    const friends = await this.getAll();
    const idx = friends.findIndex(f => f.id === friend.id);
    if (idx >= 0) friends[idx] = friend;
    else friends.push(friend);
    await this.saveAll(friends);
  }

  async delete(id: string): Promise<void> {
    const friends = await this.getAll();
    await this.saveAll(friends.filter(f => f.id !== id));
  }

  async checkIn(id: string, timestamp: number): Promise<void> {
    const friends = await this.getAll();
    const idx = friends.findIndex(f => f.id === id);
    if (idx >= 0) {
      const d = new Date(timestamp);
      const alreadyToday = friends[idx].checkIns.some(ci => {
        const c = new Date(ci);
        return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth() && c.getDate() === d.getDate();
      });
      friends[idx] = {
        ...friends[idx],
        lastCheckedIn: timestamp,
        checkIns: alreadyToday ? friends[idx].checkIns : [...friends[idx].checkIns, timestamp],
      };
      await this.saveAll(friends);
    }
  }

  async addNote(friendId: string, note: FriendNote): Promise<void> {
    const friends = await this.getAll();
    const idx = friends.findIndex(f => f.id === friendId);
    if (idx >= 0) {
      const nd = new Date(note.createdAt);
      friends[idx] = {
        ...friends[idx],
        notes: [note, ...friends[idx].notes],
        lastCheckedIn: note.createdAt,
        checkIns: friends[idx].checkIns.filter(ci => {
          const c = new Date(ci);
          return !(c.getFullYear() === nd.getFullYear() && c.getMonth() === nd.getMonth() && c.getDate() === nd.getDate());
        }),
      };
      await this.saveAll(friends);
    }
  }

  async updateNote(friendId: string, noteId: string, updates: Partial<Pick<FriendNote, 'content' | 'pinned'>>): Promise<void> {
    const friends = await this.getAll();
    const idx = friends.findIndex(f => f.id === friendId);
    if (idx >= 0) {
      friends[idx] = {
        ...friends[idx],
        notes: friends[idx].notes.map(n => n.id === noteId ? { ...n, ...updates } : n),
      };
      await this.saveAll(friends);
    }
  }

  async deleteNote(friendId: string, noteId: string): Promise<void> {
    const friends = await this.getAll();
    const idx = friends.findIndex(f => f.id === friendId);
    if (idx >= 0) {
      const note = friends[idx].notes.find(n => n.id === noteId);
      if (!note) return;
      const nd = new Date(note.createdAt);
      const alreadyHasCheckIn = friends[idx].checkIns.some(ci => {
        const c = new Date(ci);
        return c.getFullYear() === nd.getFullYear() && c.getMonth() === nd.getMonth() && c.getDate() === nd.getDate();
      });
      friends[idx] = {
        ...friends[idx],
        notes: friends[idx].notes.filter(n => n.id !== noteId),
        checkIns: alreadyHasCheckIn ? friends[idx].checkIns : [...friends[idx].checkIns, note.createdAt],
      };
      await this.saveAll(friends);
    }
  }

  async convertCheckInToNote(friendId: string, checkInTs: number, content: string): Promise<void> {
    const friends = await this.getAll();
    const idx = friends.findIndex(f => f.id === friendId);
    if (idx >= 0) {
      const note: FriendNote = { id: generateId(), content: content.trim(), createdAt: checkInTs };
      friends[idx] = {
        ...friends[idx],
        checkIns: friends[idx].checkIns.filter(ci => ci !== checkInTs),
        notes: [note, ...friends[idx].notes],
      };
      await this.saveAll(friends);
    }
  }
}
