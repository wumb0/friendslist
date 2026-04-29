import { SignificantDate } from './SignificantDate';

export { SignificantDate };

export interface FriendNote {
  id: string;
  content: string;
  createdAt: number;
  pinned?: boolean;
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
}
