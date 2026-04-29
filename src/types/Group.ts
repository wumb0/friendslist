export type GroupFrequency = 'daily' | 'weekly' | 'monthly' | 'off';

export interface Group {
  id: string;
  name: string;
  notificationFrequency: GroupFrequency;
  notificationHour: number;
  notificationMinute: number;
  notificationWeekday?: number; // 1=Sun … 7=Sat (expo-notifications WEEKLY convention)
  notificationDay?: number;     // 1-28 for monthly
  significantDatesEnabled: boolean;
}
