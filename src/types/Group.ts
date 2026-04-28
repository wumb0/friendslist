export type GroupFrequency = 'daily' | 'weekly' | 'off';

export interface Group {
  id: string;
  name: string;
  notificationFrequency: GroupFrequency;
  notificationHour: number;
  notificationMinute: number;
}
