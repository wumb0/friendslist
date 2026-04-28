export interface FriendNote {
  id: string;
  content: string;
  createdAt: number;
  pinned?: boolean;
}

export interface Friend {
  id: string;
  name: string;
  lastCheckedIn: number | null;
  createdAt: number;
  notes: FriendNote[];
  checkIns: number[];
}
