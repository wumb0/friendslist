import { FriendRepository } from '../repository/FriendRepository';

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export async function cleanupExpiredEvents(repo: FriendRepository): Promise<void> {
  const friends = await repo.getAll();
  const cutoff = startOfToday();
  for (const friend of friends) {
    const expired = friend.oneTimeEvents
      .filter(e => e.eventDate < cutoff)
      .map(e => e.id);
    if (expired.length > 0) {
      await repo.deleteExpiredEvents(friend.id, expired);
    }
  }
}
