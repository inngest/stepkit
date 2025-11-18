export interface Recipe {
  name: string;
  cuisine: string;
  description: string;
  ingredients: string[];
  instructions: string;
}

export interface Ingredient {
  name: string;
  allergens: string[];
  alternatives: string[];
}

export interface WinePairing {
  recipeName: string;
  wineType: string;
  wineName: string;
  description: string;
}

// In-memory recipe database
export const RECIPES: Recipe[] = [
  {
    name: "Classic Roast Turkey",
    cuisine: "American",
    description: "Traditional roasted turkey with herbs and butter",
    ingredients: [
      "whole turkey",
      "butter",
      "rosemary",
      "thyme",
      "garlic",
      "salt",
      "pepper",
    ],
    instructions:
      "Preheat oven to 325°F. Rub turkey with herb butter. Roast for 3-4 hours until internal temp reaches 165°F.",
  },
  {
    name: "Honey Glazed Ham",
    cuisine: "American",
    description: "Sweet and savory glazed ham perfect for holidays",
    ingredients: [
      "bone-in ham",
      "honey",
      "brown sugar",
      "dijon mustard",
      "cloves",
    ],
    instructions:
      "Score ham, insert cloves. Mix honey, sugar, and mustard. Bake at 325°F, glazing every 30 minutes.",
  },
  {
    name: "Beef Wellington",
    cuisine: "British",
    description: "Elegant beef tenderloin wrapped in puff pastry",
    ingredients: [
      "beef tenderloin",
      "puff pastry",
      "mushrooms",
      "prosciutto",
      "eggs",
      "butter",
    ],
    instructions:
      "Sear beef, wrap with mushroom duxelles and prosciutto in puff pastry. Bake at 425°F for 25-30 minutes.",
  },
  {
    name: "Herb Crusted Lamb",
    cuisine: "French",
    description: "Rack of lamb with herb and breadcrumb crust",
    ingredients: [
      "rack of lamb",
      "breadcrumbs",
      "parsley",
      "garlic",
      "dijon mustard",
      "olive oil",
    ],
    instructions:
      "Coat lamb with mustard and herb breadcrumbs. Roast at 400°F for 20-25 minutes for medium-rare.",
  },
  {
    name: "Roasted Duck with Orange Sauce",
    cuisine: "French",
    description: "Crispy duck with citrus glaze",
    ingredients: [
      "whole duck",
      "oranges",
      "orange liqueur",
      "chicken stock",
      "butter",
      "thyme",
    ],
    instructions:
      "Score duck skin, roast at 350°F for 2 hours. Prepare orange sauce with pan drippings.",
  },
  {
    name: "Vegetarian Wellington",
    cuisine: "British",
    description: "Mushroom and chestnut wrapped in puff pastry",
    ingredients: [
      "puff pastry",
      "mushrooms",
      "chestnuts",
      "spinach",
      "eggs",
      "onions",
      "garlic",
    ],
    instructions:
      "Sauté mushrooms and chestnuts, wrap in pastry with spinach. Bake at 400°F for 30 minutes.",
  },
  {
    name: "Prime Rib Roast",
    cuisine: "American",
    description: "Perfectly seasoned standing rib roast",
    ingredients: [
      "prime rib roast",
      "garlic",
      "rosemary",
      "thyme",
      "salt",
      "pepper",
      "olive oil",
    ],
    instructions:
      "Season roast generously. Roast at 450°F for 15 minutes, then 325°F until desired doneness.",
  },
  {
    name: "Baked Salmon with Dill",
    cuisine: "Scandinavian",
    description: "Oven-baked salmon with fresh dill and lemon",
    ingredients: [
      "salmon fillet",
      "dill",
      "lemon",
      "butter",
      "white wine",
      "salt",
    ],
    instructions:
      "Place salmon on foil, top with dill and lemon. Bake at 375°F for 15-20 minutes.",
  },
];

// In-memory ingredients database with allergen info
export const INGREDIENTS: Ingredient[] = [
  {
    name: "butter",
    allergens: ["dairy"],
    alternatives: ["olive oil", "coconut oil", "vegan butter"],
  },
  {
    name: "eggs",
    allergens: ["eggs"],
    alternatives: ["flax eggs", "chia eggs", "aquafaba"],
  },
  {
    name: "breadcrumbs",
    allergens: ["gluten"],
    alternatives: [
      "gluten-free breadcrumbs",
      "almond flour",
      "crushed rice crackers",
    ],
  },
  {
    name: "puff pastry",
    allergens: ["gluten", "dairy"],
    alternatives: ["gluten-free puff pastry", "phyllo dough"],
  },
  {
    name: "prosciutto",
    allergens: ["pork"],
    alternatives: ["turkey bacon", "smoked salmon", "vegetarian bacon"],
  },
  {
    name: "dijon mustard",
    allergens: ["mustard"],
    alternatives: ["whole grain mustard", "honey mustard", "mayonnaise"],
  },
  {
    name: "chestnuts",
    allergens: ["tree nuts"],
    alternatives: ["white beans", "chickpeas", "cauliflower"],
  },
  {
    name: "honey",
    allergens: ["honey"],
    alternatives: ["maple syrup", "agave nectar", "brown rice syrup"],
  },
];

// In-memory wine pairings database
export const WINE_PAIRINGS: WinePairing[] = [
  {
    recipeName: "Classic Roast Turkey",
    wineType: "White",
    wineName: "Chardonnay",
    description:
      "A buttery Chardonnay complements the rich flavors of roasted turkey",
  },
  {
    recipeName: "Honey Glazed Ham",
    wineType: "Rosé",
    wineName: "Dry Rosé",
    description:
      "The fruity notes of rosé balance the sweetness of the honey glaze",
  },
  {
    recipeName: "Beef Wellington",
    wineType: "Red",
    wineName: "Cabernet Sauvignon",
    description:
      "Bold Cabernet Sauvignon pairs perfectly with tender beef and mushrooms",
  },
  {
    recipeName: "Herb Crusted Lamb",
    wineType: "Red",
    wineName: "Bordeaux",
    description:
      "Classic Bordeaux enhances the herb and garlic flavors in lamb",
  },
  {
    recipeName: "Roasted Duck with Orange Sauce",
    wineType: "Red",
    wineName: "Pinot Noir",
    description:
      "Pinot Noir's earthy notes complement duck, while its acidity cuts through the richness",
  },
  {
    recipeName: "Vegetarian Wellington",
    wineType: "White",
    wineName: "Sauvignon Blanc",
    description:
      "Crisp Sauvignon Blanc pairs well with mushrooms and earthy flavors",
  },
  {
    recipeName: "Prime Rib Roast",
    wineType: "Red",
    wineName: "Malbec",
    description: "Rich Malbec stands up to the bold flavors of prime rib",
  },
  {
    recipeName: "Baked Salmon with Dill",
    wineType: "White",
    wineName: "Pinot Grigio",
    description:
      "Light Pinot Grigio complements the delicate flavors of salmon",
  },
];

// Simple search functions (simulating vector similarity search)
export function searchRecipesByCuisine(cuisine: string, limit = 5): Recipe[] {
  const cuisineLower = cuisine.toLowerCase();
  return RECIPES.filter((recipe) =>
    recipe.cuisine.toLowerCase().includes(cuisineLower)
  ).slice(0, limit);
}

export function searchIngredientsByAllergen(
  allergen: string,
  limit = 5
): Ingredient[] {
  const allergenLower = allergen.toLowerCase();
  return INGREDIENTS.filter((ingredient) =>
    ingredient.allergens.some((a) => a.toLowerCase().includes(allergenLower))
  ).slice(0, limit);
}

export function searchWinePairings(
  recipeName: string,
  limit = 3
): WinePairing[] {
  const recipeNameLower = recipeName.toLowerCase();
  return WINE_PAIRINGS.filter((pairing) =>
    pairing.recipeName.toLowerCase().includes(recipeNameLower)
  ).slice(0, limit);
}
