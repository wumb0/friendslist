import { Friend } from '../types/Friend';

export function sortFriends(friends: Friend[]): Friend[] {
  return [...friends].sort((a, b) => {
    if (a.lastCheckedIn === null && b.lastCheckedIn === null) return 0;
    if (a.lastCheckedIn === null) return -1;
    if (b.lastCheckedIn === null) return 1;
    return a.lastCheckedIn - b.lastCheckedIn;
  });
}
