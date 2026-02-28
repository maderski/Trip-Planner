import type { Destination } from '../trip/types.ts';
import type { CalendarEvent } from '../calendar/types.ts';
import type { Accommodation } from '../accommodations/types.ts';
import type { Restaurant } from '../restaurants/types.ts';

export type { Destination } from '../trip/types.ts';
export type { CalendarEvent } from '../calendar/types.ts';
export type { Accommodation, AccommodationType } from '../accommodations/types.ts';
export type { Restaurant, MealType, PriceRange } from '../restaurants/types.ts';

export interface TripData {
  version: 1;
  destination: Destination;
  events: CalendarEvent[];
  accommodations: Accommodation[];
  restaurants: Restaurant[];
}
