export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks' | 'Drinks';
export type PriceRange = '$' | '$$' | '$$$' | '$$$$';

export interface Restaurant {
  id: string;
  name: string;
  mealType: MealType;
  cuisineType: string;
  address: string;
  link: string;
  priceRange: PriceRange;
  notes: string;
  visited: boolean;
}
