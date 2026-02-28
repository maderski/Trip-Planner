export type AccommodationType = 'Hotel' | 'Airbnb' | 'Campground' | 'Cabin' | 'Other';

export interface Accommodation {
  id: string;
  name: string;
  type: AccommodationType;
  checkIn: string;
  checkOut: string;
  address: string;
  link: string;
  confirmationCode: string;
  notes: string;
}
