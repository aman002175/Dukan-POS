// Master Product Database for Smart Suggestions
export interface MasterProduct {
  name: string;
  category: string;
  suggestedPrice: number;
  unit: string;
}

export const masterProductDatabase: MasterProduct[] = [
  // Grocery Items
  { name: 'Aata (Wheat Flour)', category: 'Grocery', suggestedPrice: 45, unit: 'kg' },
  { name: 'Maida (Refined Flour)', category: 'Grocery', suggestedPrice: 50, unit: 'kg' },
  { name: 'Besan (Gram Flour)', category: 'Grocery', suggestedPrice: 80, unit: 'kg' },
  { name: 'Rice (Basmati)', category: 'Grocery', suggestedPrice: 120, unit: 'kg' },
  { name: 'Rice (Sona Masoori)', category: 'Grocery', suggestedPrice: 60, unit: 'kg' },
  { name: 'Rice (Raw)', category: 'Grocery', suggestedPrice: 45, unit: 'kg' },
  { name: 'Dal (Toor/Arhar)', category: 'Grocery', suggestedPrice: 140, unit: 'kg' },
  { name: 'Dal (Moong)', category: 'Grocery', suggestedPrice: 120, unit: 'kg' },
  { name: 'Dal (Masoor)', category: 'Grocery', suggestedPrice: 100, unit: 'kg' },
  { name: 'Dal (Chana)', category: 'Grocery', suggestedPrice: 80, unit: 'kg' },
  { name: 'Dal (Urad)', category: 'Grocery', suggestedPrice: 130, unit: 'kg' },
  { name: 'Sugar', category: 'Grocery', suggestedPrice: 45, unit: 'kg' },
  { name: 'Salt (Tata)', category: 'Grocery', suggestedPrice: 25, unit: 'kg' },
  { name: 'Salt (Plain)', category: 'Grocery', suggestedPrice: 15, unit: 'kg' },
  { name: 'Oil (Mustard)', category: 'Grocery', suggestedPrice: 180, unit: 'litre' },
  { name: 'Oil (Refined)', category: 'Grocery', suggestedPrice: 140, unit: 'litre' },
  { name: 'Oil (Groundnut)', category: 'Grocery', suggestedPrice: 200, unit: 'litre' },
  { name: 'Ghee (Desi)', category: 'Grocery', suggestedPrice: 600, unit: 'kg' },
  { name: 'Ghee (Dalda)', category: 'Grocery', suggestedPrice: 120, unit: 'kg' },
  { name: 'Turmeric Powder', category: 'Grocery', suggestedPrice: 300, unit: 'kg' },
  { name: 'Red Chilli Powder', category: 'Grocery', suggestedPrice: 350, unit: 'kg' },
  { name: 'Coriander Powder', category: 'Grocery', suggestedPrice: 200, unit: 'kg' },
  { name: 'Cumin Seeds', category: 'Grocery', suggestedPrice: 400, unit: 'kg' },
  { name: 'Mustard Seeds', category: 'Grocery', suggestedPrice: 180, unit: 'kg' },
  { name: 'Tea (Brooke Bond)', category: 'Grocery', suggestedPrice: 450, unit: 'kg' },
  { name: 'Tea (Tata)', category: 'Grocery', suggestedPrice: 500, unit: 'kg' },
  { name: 'Tea (Local)', category: 'Grocery', suggestedPrice: 300, unit: 'kg' },
  { name: 'Coffee', category: 'Grocery', suggestedPrice: 350, unit: 'kg' },
  
  // Snacks
  { name: 'Biscuits (Parle-G)', category: 'Snacks', suggestedPrice: 10, unit: 'pack' },
  { name: 'Biscuits (Good Day)', category: 'Snacks', suggestedPrice: 30, unit: 'pack' },
  { name: 'Biscuits (Hide & Seek)', category: 'Snacks', suggestedPrice: 35, unit: 'pack' },
  { name: 'Biscuits (Oreo)', category: 'Snacks', suggestedPrice: 30, unit: 'pack' },
  { name: 'Chips (Lays)', category: 'Snacks', suggestedPrice: 20, unit: 'pack' },
  { name: 'Chips (Kurkure)', category: 'Snacks', suggestedPrice: 20, unit: 'pack' },
  { name: 'Namkeen (Haldiram)', category: 'Snacks', suggestedPrice: 60, unit: 'pack' },
  { name: 'Namkeen (Local)', category: 'Snacks', suggestedPrice: 40, unit: 'pack' },
  { name: 'Sweets (Kaju Katli)', category: 'Snacks', suggestedPrice: 800, unit: 'kg' },
  { name: 'Sweets (Laddu)', category: 'Snacks', suggestedPrice: 400, unit: 'kg' },
  { name: 'Sweets (Jalebi)', category: 'Snacks', suggestedPrice: 350, unit: 'kg' },
  { name: 'Chocolate (Dairy Milk)', category: 'Snacks', suggestedPrice: 40, unit: 'pc' },
  { name: 'Chocolate (KitKat)', category: 'Snacks', suggestedPrice: 30, unit: 'pc' },
  { name: 'Chocolate (5 Star)', category: 'Snacks', suggestedPrice: 25, unit: 'pc' },
  
  // Beverages
  { name: 'Cold Drink (Coke)', category: 'Beverages', suggestedPrice: 40, unit: 'bottle' },
  { name: 'Cold Drink (Pepsi)', category: 'Beverages', suggestedPrice: 40, unit: 'bottle' },
  { name: 'Cold Drink (Sprite)', category: 'Beverages', suggestedPrice: 40, unit: 'bottle' },
  { name: 'Cold Drink (Fanta)', category: 'Beverages', suggestedPrice: 40, unit: 'bottle' },
  { name: 'Cold Drink (Thums Up)', category: 'Beverages', suggestedPrice: 40, unit: 'bottle' },
  { name: 'Water Bottle (1L)', category: 'Beverages', suggestedPrice: 20, unit: 'bottle' },
  { name: 'Water Bottle (500ml)', category: 'Beverages', suggestedPrice: 10, unit: 'bottle' },
  { name: 'Juice (Real)', category: 'Beverages', suggestedPrice: 85, unit: 'litre' },
  { name: 'Juice (Tropicana)', category: 'Beverages', suggestedPrice: 90, unit: 'litre' },
  { name: 'Energy Drink (Red Bull)', category: 'Beverages', suggestedPrice: 125, unit: 'can' },
  { name: 'Energy Drink (Monster)', category: 'Beverages', suggestedPrice: 110, unit: 'can' },
  
  // Dairy
  { name: 'Milk (Full Cream)', category: 'Dairy', suggestedPrice: 65, unit: 'litre' },
  { name: 'Milk (Toned)', category: 'Dairy', suggestedPrice: 55, unit: 'litre' },
  { name: 'Milk (Double Toned)', category: 'Dairy', suggestedPrice: 50, unit: 'litre' },
  { name: 'Curd', category: 'Dairy', suggestedPrice: 70, unit: 'kg' },
  { name: 'Butter (Amul)', category: 'Dairy', suggestedPrice: 250, unit: '500g' },
  { name: 'Cheese (Amul)', category: 'Dairy', suggestedPrice: 120, unit: '200g' },
  { name: 'Paneer', category: 'Dairy', suggestedPrice: 320, unit: 'kg' },
  { name: 'Cream', category: 'Dairy', suggestedPrice: 180, unit: '250ml' },
  
  // Personal Care
  { name: 'Soap (Lux)', category: 'Personal Care', suggestedPrice: 35, unit: 'pc' },
  { name: 'Soap (Lifebuoy)', category: 'Personal Care', suggestedPrice: 30, unit: 'pc' },
  { name: 'Soap (Dove)', category: 'Personal Care', suggestedPrice: 55, unit: 'pc' },
  { name: 'Shampoo (Clinic Plus)', category: 'Personal Care', suggestedPrice: 3, unit: 'sachet' },
  { name: 'Shampoo (Sunsilk)', category: 'Personal Care', suggestedPrice: 3, unit: 'sachet' },
  { name: 'Toothpaste (Colgate)', category: 'Personal Care', suggestedPrice: 55, unit: '100g' },
  { name: 'Toothpaste (Pepsodent)', category: 'Personal Care', suggestedPrice: 50, unit: '100g' },
  { name: 'Toothbrush', category: 'Personal Care', suggestedPrice: 25, unit: 'pc' },
  { name: 'Detergent (Surf Excel)', category: 'Personal Care', suggestedPrice: 120, unit: 'kg' },
  { name: 'Detergent (Tide)', category: 'Personal Care', suggestedPrice: 100, unit: 'kg' },
  { name: 'Detergent (Ariel)', category: 'Personal Care', suggestedPrice: 140, unit: 'kg' },
  { name: 'Washing Soap (Rin)', category: 'Personal Care', suggestedPrice: 15, unit: 'pc' },
  
  // Household
  { name: 'Matchbox', category: 'Household', suggestedPrice: 5, unit: 'pc' },
  { name: 'Incense Sticks (Agarbatti)', category: 'Household', suggestedPrice: 30, unit: 'pack' },
  { name: 'Mosquito Coil (Good Knight)', category: 'Household', suggestedPrice: 45, unit: 'pack' },
  { name: 'Mosquito Coil (Mortein)', category: 'Household', suggestedPrice: 50, unit: 'pack' },
  { name: 'Candle', category: 'Household', suggestedPrice: 20, unit: 'pc' },
  { name: 'Battery (Eveready)', category: 'Household', suggestedPrice: 30, unit: 'pc' },
  { name: 'Battery (Duracell)', category: 'Household', suggestedPrice: 50, unit: 'pc' },
  { name: 'Bulb (LED)', category: 'Household', suggestedPrice: 80, unit: 'pc' },
  { name: 'Bulb (CFL)', category: 'Household', suggestedPrice: 120, unit: 'pc' },
  
  // Stationery
  { name: 'Pen (Ball)', category: 'Stationery', suggestedPrice: 10, unit: 'pc' },
  { name: 'Pen (Gel)', category: 'Stationery', suggestedPrice: 15, unit: 'pc' },
  { name: 'Pencil', category: 'Stationery', suggestedPrice: 5, unit: 'pc' },
  { name: 'Eraser', category: 'Stationery', suggestedPrice: 5, unit: 'pc' },
  { name: 'Sharpener', category: 'Stationery', suggestedPrice: 5, unit: 'pc' },
  { name: 'Notebook (Small)', category: 'Stationery', suggestedPrice: 25, unit: 'pc' },
  { name: 'Notebook (Long)', category: 'Stationery', suggestedPrice: 40, unit: 'pc' },
  { name: 'Register', category: 'Stationery', suggestedPrice: 80, unit: 'pc' },
  
  // Miscellaneous
  { name: 'Cigarette (Classic)', category: 'Miscellaneous', suggestedPrice: 18, unit: 'pc' },
  { name: 'Cigarette (Gold Flake)', category: 'Miscellaneous', suggestedPrice: 16, unit: 'pc' },
  { name: 'Paan Masala', category: 'Miscellaneous', suggestedPrice: 50, unit: 'pack' },
  { name: 'Gutkha', category: 'Miscellaneous', suggestedPrice: 20, unit: 'pack' },
  { name: 'Bread', category: 'Miscellaneous', suggestedPrice: 35, unit: 'pc' },
  { name: 'Eggs', category: 'Miscellaneous', suggestedPrice: 8, unit: 'pc' },
];

export const categories = [
  'All',
  'Grocery',
  'Snacks',
  'Beverages',
  'Dairy',
  'Personal Care',
  'Household',
  'Stationery',
  'Miscellaneous',
];

export function getProductSuggestions(query: string): MasterProduct[] {
  if (!query || query.length < 2) return [];
  const lowerQuery = query.toLowerCase();
  return masterProductDatabase
    .filter(p => p.name.toLowerCase().includes(lowerQuery))
    .slice(0, 5);
}
