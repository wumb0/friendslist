import { SignificantDate } from './SignificantDate';

export { SignificantDate };

export interface FriendNote {
  id: string;
  content: string;
  createdAt: number;
  pinned?: boolean;
}

export interface OneTimeEvent {
  id: string;
  label: string;
  eventDate: number;         // midnight-local timestamp for the event day
  notifyDaysBefore: number;  // 0 | 1 | 2 | 7
  notifyHour: number;
  notifyMinute: number;
  notifyEnabled: boolean;
}

export interface Friend {
  id: string;
  name: string;
  groupId: string;
  lastCheckedIn: number | null;
  createdAt: number;
  notes: FriendNote[];
  checkIns: number[];
  significantDates?: SignificantDate[];
  oneTimeEvents?: OneTimeEvent[];
}
