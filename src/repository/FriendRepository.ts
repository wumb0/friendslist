import { Friend, FriendNote, SignificantDate } from '../types/Friend';

export interface FriendRepository {
  getAll(): Promise<Friend[]>;
  save(friend: Friend): Promise<void>;
  delete(id: string): Promise<void>;
  checkIn(id: string, timestamp: number): Promise<void>;
  addNote(friendId: string, note: FriendNote): Promise<void>;
  updateNote(friendId: string, noteId: string, updates: Partial<Pick<FriendNote, 'content' | 'pinned'>>): Promise<void>;
  deleteNote(friendId: string, noteId: string): Promise<void>;
  convertCheckInToNote(friendId: string, checkInTs: number, content: string): Promise<void>;
  addSignificantDate(friendId: string, date: SignificantDate): Promise<void>;
  updateSignificantDate(friendId: string, dateId: string, updates: Partial<Omit<SignificantDate, 'id'>>): Promise<void>;
  deleteSignificantDate(friendId: string, dateId: string): Promise<void>;
}
