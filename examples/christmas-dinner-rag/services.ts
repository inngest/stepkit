/* eslint-disable */
import type { Ingredient, Recipe } from "./data";
import { getOpenAI } from "./openai";

/**
 * Analyzes dietary restrictions using OpenAI to extract allergens
 */
export async function analyzeDietaryRestrictions(
  restrictions: string
): Promise<string[]> {
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a dietary restrictions analyzer. Extract specific allergens and dietary restrictions from user input. Return ONLY a JSON array of allergen strings. Valid allergens: dairy, gluten, tree nuts, eggs, pork, shellfish, fish, soy, honey.",
      },
      {
        role: "user",
        content: `Extract allergens from this text: "${restrictions}"`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return [];
  }

  try {
    const parsed = JSON.parse(content);
    return parsed.allergens || [];
  } catch {
    return [];
  }
}

/**
 * Generates an elegant menu description using OpenAI based on retrieved recipes (RAG pattern)
 */
export async function generateMenuDescription(
  recipes: Recipe[],
  participants: number,
  alternatives?: Map<string, string[]>
): Promise<string> {
  const openai = getOpenAI();

  // Prepare recipe context for RAG
  const recipeContext = recipes
    .map((recipe, index) => {
      let context = `Recipe ${index + 1}: ${recipe.name}
- Cuisine: ${recipe.cuisine}
- Description: ${recipe.description}
- Ingredients: ${recipe.ingredients.join(", ")}
- Instructions: ${recipe.instructions}`;

      if (alternatives && alternatives.size > 0) {
        const subs: string[] = [];
        recipe.ingredients.forEach((ingredient) => {
          if (alternatives.has(ingredient)) {
            subs.push(
              `${ingredient} can be substituted with ${alternatives.get(ingredient)!.join(" or ")}`
            );
          }
        });
        if (subs.length > 0) {
          context += `\n- Substitutions needed: ${subs.join("; ")}`;
        }
      }

      return context;
    })
    .join("\n\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a professional Christmas dinner menu writer. Create an elegant, festive menu description based on the provided recipes. Include the recipe name, cuisine type, a brief description, and any necessary ingredient substitutions. Format it beautifully for ${participants} guests.`,
      },
      {
        role: "user",
        content: `Create a Christmas dinner menu for ${participants} guests using these recipes:\n\n${recipeContext}`,
      },
    ],
    temperature: 0.7,
  });

  return (
    response.choices[0]?.message?.content ||
    `🎄 Christmas Dinner Menu for ${participants} guests`
  );
}

/**
 * Creates an organized shopping list using OpenAI
 */
export async function createShoppingList(
  recipes: Recipe[],
  participants: number,
  alternatives?: Map<string, string[]>
): Promise<string> {
  const openai = getOpenAI();

  // Collect all ingredients with substitutions
  const ingredientsSet = new Set<string>();

  recipes.forEach((recipe) => {
    recipe.ingredients.forEach((ingredient) => {
      if (alternatives && alternatives.has(ingredient)) {
        alternatives.get(ingredient)!.forEach((alt) => ingredientsSet.add(alt));
      } else {
        ingredientsSet.add(ingredient);
      }
    });
  });

  const ingredientsList = Array.from(ingredientsSet).sort().join(", ");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful shopping list organizer. Create a well-organized shopping list grouped by category (Produce, Proteins, Dairy, Pantry, etc.). Include approximate quantities based on the number of guests. Format as a checklist.",
      },
      {
        role: "user",
        content: `Create a shopping list for ${participants} guests using these ingredients: ${ingredientsList}`,
      },
    ],
    temperature: 0.3,
  });

  return (
    response.choices[0]?.message?.content ||
    `🛒 Shopping List (for ${participants} guests)\n\n${Array.from(
      ingredientsSet
    )
      .sort()
      .map((i) => `□ ${i}`)
      .join("\n")}`
  );
}

/**
 * Builds ingredient alternatives map from detected allergens
 */
export function buildAlternativesMap(
  alternatives: Ingredient[]
): Map<string, string[]> {
  const alternativesMap = new Map<string, string[]>();
  alternatives.forEach((ingredient) => {
    alternativesMap.set(ingredient.name, ingredient.alternatives);
  });
  return alternativesMap;
}
