export interface SignificantDate {
  id: string;
  label: string;
  month: number;
  day: number;
  year?: number;
  notifyEnabled: boolean;
  notifyHour: number;
  notifyMinute: number;
}
