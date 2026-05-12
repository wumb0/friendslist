import AsyncStorage from '@react-native-async-storage/async-storage';
import { Friend, FriendNote, SignificantDate, OneTimeEvent } from '../types/Friend';
import { FriendRepository } from './FriendRepository';
import { generateId } from '../utils/uuid';

const STORAGE_KEY = 'friends_v1';

export class AsyncStorageFriendRepository implements FriendRepository {
  async getAll(): Promise<Friend[]> {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) return [];
    const raw = JSON.parse(json) as any[];
    return raw.map(f => ({
      ...f,
      significantDates: Array.isArray(f.significantDates) ? f.significantDates : [],
      oneTimeEvents: Array.isArray(f.oneTimeEvents) ? f.oneTimeEvents : [],
    })) as Friend[];
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

  async updateCheckInDate(friendId: string, oldTs: number, newTs: number): Promise<void> {
    const friends = await this.getAll();
    const idx = friends.findIndex(f => f.id === friendId);
    if (idx < 0) return;
    const friend = friends[idx];
    const newDate = new Date(newTs);
    const newDayAlreadyHasCheckIn = friend.checkIns.some(ci => {
      if (ci === oldTs) return false;
      const c = new Date(ci);
      return c.getFullYear() === newDate.getFullYear() && c.getMonth() === newDate.getMonth() && c.getDate() === newDate.getDate();
    });
    const updatedCheckIns = [
      ...friend.checkIns.filter(ci => ci !== oldTs),
      ...(newDayAlreadyHasCheckIn ? [] : [newTs]),
    ];
    const allTs = [...updatedCheckIns, ...friend.notes.map(n => n.createdAt)];
    const lastCheckedIn = allTs.length > 0 ? Math.max(...allTs) : null;
    friends[idx] = { ...friend, checkIns: updatedCheckIns, lastCheckedIn };
    await this.saveAll(friends);
  }

  async updateNoteDate(friendId: string, noteId: string, newCreatedAt: number): Promise<void> {
    const friends = await this.getAll();
    const idx = friends.findIndex(f => f.id === friendId);
    if (idx < 0) return;
    const friend = friends[idx];
    const updatedNotes = friend.notes.map(n => n.id === noteId ? { ...n, createdAt: newCreatedAt } : n);
    const allTs = [...friend.checkIns, ...updatedNotes.map(n => n.createdAt)];
    const lastCheckedIn = allTs.length > 0 ? Math.max(...allTs) : null;
    friends[idx] = { ...friend, notes: updatedNotes, lastCheckedIn };
    await this.saveAll(friends);
  }

  async addSignificantDate(friendId: string, date: SignificantDate): Promise<void> {
    const friends = await this.getAll();
    const idx = friends.findIndex(f => f.id === friendId);
    if (idx >= 0) {
      friends[idx] = {
        ...friends[idx],
        significantDates: [...friends[idx].significantDates, date],
      };
      await this.saveAll(friends);
    }
  }

  async updateSignificantDate(friendId: string, dateId: string, updates: Partial<Omit<SignificantDate, 'id'>>): Promise<void> {
    const friends = await this.getAll();
    const idx = friends.findIndex(f => f.id === friendId);
    if (idx >= 0) {
      friends[idx] = {
        ...friends[idx],
        significantDates: friends[idx].significantDates.map(d =>
          d.id === dateId ? { ...d, ...updates } : d
        ),
      };
      await this.saveAll(friends);
    }
  }

  async deleteSignificantDate(friendId: string, dateId: string): Promise<void> {
    const friends = await this.getAll();
    const idx = friends.findIndex(f => f.id === friendId);
    if (idx >= 0) {
      friends[idx] = {
        ...friends[idx],
        significantDates: friends[idx].significantDates.filter(d => d.id !== dateId),
      };
      await this.saveAll(friends);
    }
  }

  async addOneTimeEvent(friendId: string, event: OneTimeEvent): Promise<void> {
    const friends = await this.getAll();
    const idx = friends.findIndex(f => f.id === friendId);
    if (idx >= 0) {
      friends[idx] = {
        ...friends[idx],
        oneTimeEvents: [...friends[idx].oneTimeEvents, event],
      };
      await this.saveAll(friends);
    }
  }

  async updateOneTimeEvent(friendId: string, eventId: string, updates: Partial<Omit<OneTimeEvent, 'id'>>): Promise<void> {
    const friends = await this.getAll();
    const idx = friends.findIndex(f => f.id === friendId);
    if (idx >= 0) {
      friends[idx] = {
        ...friends[idx],
        oneTimeEvents: friends[idx].oneTimeEvents.map(e =>
          e.id === eventId ? { ...e, ...updates } : e
        ),
      };
      await this.saveAll(friends);
    }
  }

  async deleteOneTimeEvent(friendId: string, eventId: string): Promise<void> {
    const friends = await this.getAll();
    const idx = friends.findIndex(f => f.id === friendId);
    if (idx >= 0) {
      friends[idx] = {
        ...friends[idx],
        oneTimeEvents: friends[idx].oneTimeEvents.filter(e => e.id !== eventId),
      };
      await this.saveAll(friends);
    }
  }

  async deleteExpiredEvents(friendId: string, eventIds: string[]): Promise<void> {
    const friends = await this.getAll();
    const idx = friends.findIndex(f => f.id === friendId);
    if (idx >= 0) {
      friends[idx] = {
        ...friends[idx],
        oneTimeEvents: friends[idx].oneTimeEvents.filter(e => !eventIds.includes(e.id)),
      };
      await this.saveAll(friends);
    }
  }
}
