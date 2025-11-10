/* eslint-disable */
import { z } from "zod";

import { client } from "./client";
import {
  searchIngredientsByAllergen,
  searchRecipesByCuisine,
  searchWinePairings,
  type Ingredient,
  type WinePairing,
} from "./data";
import {
  analyzeDietaryRestrictions,
  buildAlternativesMap,
  createShoppingList,
  generateMenuDescription,
} from "./services";

// Input schema for the workflow
const DinnerPlanInput = z.object({
  participants: z.number().min(1).max(20),
  cuisinePreference: z.string(),
  dietaryRestrictions: z.string().optional(),
});

export const christmasDinnerWorkflow = client.workflow(
  {
    id: "christmas-dinner-planner",
    inputSchema: DinnerPlanInput,
  },
  async (ctx, step) => {
    const { participants, cuisinePreference, dietaryRestrictions } =
      ctx.input.data;

    console.log(
      `🎅 Planning Christmas dinner for ${participants} guests with ${cuisinePreference} cuisine`
    );

    // Step 1: Query relevant recipes by cuisine
    const recipes = await step.run("query-recipes-by-cuisine", async () => {
      console.log(`🔍 Searching for ${cuisinePreference} recipes...`);
      const results = searchRecipesByCuisine(cuisinePreference, 3);
      console.log(`Found ${results.length} recipes`);
      return results;
    });

    // Step 2: Analyze dietary restrictions for allergies
    const detectedAllergens = await step.run(
      "analyze-dietary-restrictions",
      async () => {
        if (!dietaryRestrictions) {
          console.log("ℹ️  No dietary restrictions specified");
          return [];
        }

        console.log(
          `🔍 Analyzing dietary restrictions: "${dietaryRestrictions}"`
        );
        const allergens = await analyzeDietaryRestrictions(dietaryRestrictions);

        if (allergens.length > 0) {
          console.log(`⚠️  Detected allergens: ${allergens.join(", ")}`);
        } else {
          console.log("✅ No specific allergens detected");
        }

        return allergens;
      }
    );

    // Step 3: Conditionally fetch ingredient alternatives if allergies detected
    let ingredientAlternatives: Map<string, string[]> | undefined;

    if (detectedAllergens.length > 0) {
      const alternatives = await step.run(
        "fetch-ingredient-alternatives",
        async () => {
          console.log("🔄 Fetching ingredient alternatives...");
          const allAlternatives: Ingredient[] = [];

          for (const allergen of detectedAllergens) {
            const results = searchIngredientsByAllergen(allergen, 5);
            allAlternatives.push(...results);
          }

          console.log(
            `Found alternatives for ${allAlternatives.length} ingredients`
          );
          return allAlternatives;
        }
      );

      ingredientAlternatives = buildAlternativesMap(alternatives);
    }

    // Step 4: Generate menu using OpenAI (RAG pattern)
    const menu = await step.run("generate-menu", async () => {
      console.log("📝 Generating menu with OpenAI...");
      return await generateMenuDescription(
        recipes,
        participants,
        ingredientAlternatives
      );
    });

    console.log("\n" + menu);

    // Step 5: Query wine pairings
    const winePairings = await step.run("query-wine-pairings", async () => {
      console.log("🍷 Finding wine pairings...");
      const pairings: WinePairing[] = [];

      for (const recipe of recipes) {
        const results = searchWinePairings(recipe.name, 1);
        pairings.push(...results);
      }

      console.log(`Found ${pairings.length} wine pairings`);
      return pairings;
    });

    // Step 6: Create final menu with wine pairings and shopping list
    const finalOutput = await step.run("create-final-output", async () => {
      console.log("✨ Creating final output...");

      let output = menu;

      // Add wine pairings
      output += "\n🍷 Wine Pairings\n\n";
      winePairings.forEach((pairing, index) => {
        output += `${index + 1}. ${pairing.wineName} (${pairing.wineType})\n`;
        output += `   For: ${pairing.recipeName}\n`;
        output += `   ${pairing.description}\n\n`;
      });

      // Add shopping list
      output += "\n";
      output += await createShoppingList(
        recipes,
        participants,
        ingredientAlternatives
      );

      return output;
    });

    console.log("\n" + finalOutput);

    return {
      success: true,
      menu,
      winePairings,
      shoppingList: await createShoppingList(
        recipes,
        participants,
        ingredientAlternatives
      ),
    };
  }
);
