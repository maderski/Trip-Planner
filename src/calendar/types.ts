export interface CalendarEvent {
  id: string;
  date: string;
  endDate?: string;
  time: string;
  title: string;
  description: string;
  location: string;
  mapLink: string;
  photos: string[];
}
