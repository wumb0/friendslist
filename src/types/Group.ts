export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly';

export interface Schedule {
  id: string;
  frequency: ScheduleFrequency;
  hour: number;
  minute: number;
  weekday?: number; // 1=Sun…7=Sat, weekly only
  day?: number;     // 1–28, monthly only
}

export interface Group {
  id: string;
  name: string;
  schedules: Schedule[];
  significantDatesEnabled: boolean;
}
