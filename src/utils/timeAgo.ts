const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function timeAgo(timestamp: number | null): string {
  if (timestamp === null) return 'Never';

  const now = new Date();
  const then = new Date(timestamp);

  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thenMidnight = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const daysDiff = Math.round((nowMidnight.getTime() - thenMidnight.getTime()) / 86400000);

  if (daysDiff === 0) return 'Today';
  if (daysDiff === 1) return 'Yesterday';
  if (daysDiff < 7) return DAYS[then.getDay()];

  const weeks = Math.floor(daysDiff / 7);
  if (weeks < 5) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;

  const months = (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;

  const years = Math.floor(months / 12);
  if (years < 5) return years === 1 ? '1 year ago' : `${years} years ago`;

  return 'A long time ago';
}

export function urgencyColor(timestamp: number | null): string {
  if (timestamp === null) return '#AF52DE';
  const days = (Date.now() - timestamp) / 86400000;
  if (days > 30) return '#FF3B30';
  if (days > 14) return '#FF9500';
  if (days > 7) return '#FFCC00';
  if (days > 3) return '#34C759';
  return '#8E8E93';
}
