# Building an AI Workflow with StepKit: A Step-by-Step Tutorial


This tutorial will guide you through building a AI workflow using the StepKit Inngest client with Express. By the end, you'll understand how to create intelligent, agentic workflows that combine retrieval and generation (RAG pattern).

## Our Christmas Dinner RAG workflow

- Searches recipes based on cuisine preferences
- Analyzes dietary restrictions using AI
- Conditionally fetches ingredient alternatives (agentic behavior!)
- Generates elegant menus using the RAG pattern
- Creates organized shopping lists


## Prerequisites

- Node.js 18+ installed
- Basic TypeScript knowledge
- OpenAI API key ([get one here](https://platform.openai.com/api-keys))
- 10 minutes of your time

## Part 1: Project Setup

### Step 1: Create Your Project

```bash
mkdir christmas-dinner-workflow
cd christmas-dinner-workflow
npm init -y
```

### Step 2: Install Dependencies

```bash
npm install @stepkit/core @stepkit/inngest inngest express dotenv openai zod
npm install -D typescript tsx @types/express @types/node
```

**What we installed:**
- `@stepkit/core` + `@stepkit/inngest`: The StepKit framework
- `inngest`: Workflow execution engine
- `express`: Web server
- `openai`: For AI generation
- `zod`: Runtime type validation

### Step 3: Create Configuration Files

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["./**/*"],
  "exclude": ["node_modules"]
}
```

Create `.env`:

```bash
OPENAI_API_KEY=sk-your-key-here
PORT=3000
```

## Part 2: Building the Workflow

### Step 4: Create the StepKit Client

Create `client.ts`:

```typescript
import { InngestClient } from "@stepkit/inngest";

export const client = new InngestClient({
  id: "christmas-dinner-rag",
});
```

**Key concept**: The client is your entry point to StepKit. It manages workflow registration and execution.

### Step 5: Set Up OpenAI

Create `openai.ts`:

```typescript
import OpenAI from "openai";

let openaiInstance: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (openaiInstance) {
    return openaiInstance;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }

  openaiInstance = new OpenAI({ apiKey });
  return openaiInstance;
}
```

### Step 6: Create Sample Data

For this tutorial, we'll use in-memory data. Create `data.ts`:

**Note**: We're keeping data separate from business logic for better organization.

```typescript
export interface Recipe {
  name: string;
  cuisine: string;
  description: string;
  ingredients: string[];
  instructions: string;
}

export const RECIPES: Recipe[] = [
  {
    name: "Classic Roast Turkey",
    cuisine: "American",
    description: "Traditional roasted turkey with herbs and butter",
    ingredients: ["whole turkey", "butter", "rosemary", "thyme", "garlic"],
    instructions: "Preheat oven to 325°F. Rub turkey with herb butter. Roast for 3-4 hours.",
  },
  {
    name: "Herb Crusted Lamb",
    cuisine: "French",
    description: "Rack of lamb with herb and breadcrumb crust",
    ingredients: ["rack of lamb", "breadcrumbs", "parsley", "garlic", "dijon mustard"],
    instructions: "Coat lamb with mustard and herb breadcrumbs. Roast at 400°F for 20-25 minutes.",
  },
  // Add more recipes as needed
];

export function searchRecipesByCuisine(cuisine: string, limit = 3): Recipe[] {
  const cuisineLower = cuisine.toLowerCase();
  return RECIPES.filter((recipe) =>
    recipe.cuisine.toLowerCase().includes(cuisineLower)
  ).slice(0, limit);
}
```

### Step 7: Create Business Logic Services

Let's separate our business logic from workflow orchestration. Create `services.ts`:

```typescript
import { getOpenAI } from "./openai";
import type { Ingredient, Recipe } from "./data";

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
        content: "Extract allergens from text. Return JSON with 'allergens' array.",
      },
      {
        role: "user",
        content: `Extract allergens: "${restrictions}"`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
  return parsed.allergens || [];
}

/**
 * Generates menu description using OpenAI (RAG pattern)
 */
export async function generateMenuDescription(
  recipes: Recipe[],
  participants: number,
  alternatives?: Map<string, string[]>
): Promise<string> {
  const openai = getOpenAI();

  // Prepare recipe context from retrieved data
  const recipeContext = recipes
    .map((r) => `${r.name}: ${r.description}. Ingredients: ${r.ingredients.join(", ")}`)
    .join("\n\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Create an elegant Christmas dinner menu for ${participants} guests.`,
      },
      {
        role: "user",
        content: `Create a menu using these recipes:\n\n${recipeContext}`,
      },
    ],
  });

  return response.choices[0]?.message?.content || "Menu generation failed";
}

/**
 * Creates organized shopping list using OpenAI
 */
export async function createShoppingList(
  recipes: Recipe[],
  participants: number,
  alternatives?: Map<string, string[]>
): Promise<string> {
  // Implementation similar to above
  // ... (see full code in repository)
}

/**
 * Builds ingredient alternatives map
 */
export function buildAlternativesMap(alternatives: Ingredient[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  alternatives.forEach((ingredient) => {
    map.set(ingredient.name, ingredient.alternatives);
  });
  return map;
}
```

**Key concept**: Separating business logic from workflow orchestration makes your code:
- **More testable**: You can unit test services independently
- **More maintainable**: Business logic changes don't affect workflow structure
- **More reusable**: Services can be used in multiple workflows

### Step 8: Build the Workflow

Now for the exciting part! Create `workflow.ts`:

```typescript
import { z } from "zod";
import { client } from "./client";
import { searchRecipesByCuisine, searchIngredientsByAllergen } from "./data";
import {
  analyzeDietaryRestrictions,
  buildAlternativesMap,
  generateMenuDescription,
} from "./services";

// Define input schema with Zod for type safety and validation
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
    // Access validated input
    const { participants, cuisinePreference, dietaryRestrictions } = ctx.input.data;

    console.log(`🎅 Planning dinner for ${participants} guests with ${cuisinePreference} cuisine`);

    // STEP 1: Retrieve recipes from knowledge base
    const recipes = await step.run("query-recipes", async () => {
      console.log(`🔍 Searching for ${cuisinePreference} recipes...`);
      return searchRecipesByCuisine(cuisinePreference, 3);
    });

    // STEP 2: Use AI to analyze dietary restrictions
    const detectedAllergens = await step.run("analyze-restrictions", async () => {
      if (!dietaryRestrictions) return [];

      console.log(`🔍 Analyzing dietary restrictions: "${dietaryRestrictions}"`);
      const allergens = await analyzeDietaryRestrictions(dietaryRestrictions);

      if (allergens.length > 0) {
        console.log(`⚠️ Detected allergens: ${allergens.join(", ")}`);
      }

      return allergens;
    });

    // STEP 3: Conditionally fetch alternatives (Agentic pattern!)
    let ingredientAlternatives = undefined;
    if (detectedAllergens.length > 0) {
      const alternatives = await step.run("fetch-alternatives", async () => {
        console.log("🔄 Fetching ingredient alternatives...");
        const allAlternatives = [];

        for (const allergen of detectedAllergens) {
          const results = searchIngredientsByAllergen(allergen, 5);
          allAlternatives.push(...results);
        }

        return allAlternatives;
      });

      ingredientAlternatives = buildAlternativesMap(alternatives);
    }

    // STEP 4: Generate menu using RAG pattern
    const menu = await step.run("generate-menu", async () => {
      console.log("📝 Generating menu with OpenAI...");
      return await generateMenuDescription(recipes, participants, ingredientAlternatives);
    });

    console.log("\n" + menu);

    return {
      success: true,
      menu,
      recipes: recipes.length,
      allergensDetected: detectedAllergens.length,
    };
  }
);
```

**Key concepts explained:**

1. **Separation of Concerns**: Notice how clean the workflow is! All business logic (OpenAI calls, data processing) lives in `services.ts`. The workflow only orchestrates the steps.

2. **`step.run()`**: Each step is isolated and retryable. If a step fails, it automatically retries without re-running previous steps.

3. **Agentic Pattern** (lines with `if (detectedAllergens.length > 0)`): The workflow makes intelligent decisions based on runtime data. Step 3 only runs when needed!

4. **RAG Pattern** (Step 4): We retrieve factual data (recipes) in Step 1, then use AI to generate creative output grounded in that data in Step 4. This prevents hallucination!

### Step 9: Create the Express Server

Create `main.ts`:

```typescript
import "dotenv/config";
import express from "express";
import { serve } from "inngest/express";
import { inngestify } from "@stepkit/inngest";
import { client } from "./client";
import { christmasDinnerWorkflow } from "./workflow";

const app = express();
app.use(express.json());

// Mount Inngest endpoint
app.use("/api/inngest", serve(inngestify(client, [christmasDinnerWorkflow])));

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  console.log(`🎅 Server running on http://localhost:${PORT}`);
  console.log(`📡 Inngest endpoint: http://localhost:${PORT}/api/inngest`);
});
```

### Step 10: Add NPM Scripts

Update your `package.json`:

```json
{
  "scripts": {
    "dev": "tsx --watch main.ts",
    "inngest:devserver": "npx inngest-cli@latest dev -u http://localhost:3000/api/inngest"
  }
}
```

## Part 3: Testing Your Workflow

### Step 11: Start Your Application

Open two terminal windows:

**Terminal 1** - Start your Express server:
```bash
npm run dev
```

You should see:
```
🎅 Server running on http://localhost:3000
📡 Inngest endpoint: http://localhost:3000/api/inngest
```

<!-- SCREENSHOT: Terminal showing server startup logs -->

**Terminal 2** - Start the Inngest Dev Server:
```bash
npm run inngest:devserver
```

This launches a local development UI at `http://localhost:8288`.

<!-- SCREENSHOT: Inngest Dev Server startup in terminal -->

### Step 12: Trigger Your Workflow

Open your browser to `http://localhost:8288`.

<!-- SCREENSHOT: Inngest Dev Server homepage showing registered workflows -->

1. Click on the `christmas-dinner-planner` workflow
2. Click the "Invoke Function" button
3. Paste this JSON payload:

```json
{
  "participants": 6,
  "cuisinePreference": "French",
  "dietaryRestrictions": "gluten-free, no dairy"
}
```

<!-- SCREENSHOT: Invoke function dialog with JSON payload -->

4. Click "Invoke"

### Step 13: Observe Your Workflow

Watch the magic happen! You'll see:

1. **Function Runs**: Each execution appears in the timeline
2. **Step-by-step execution**: Click into a run to see each step
3. **Output logs**: See console.log outputs from each step
4. **Timing information**: How long each step took
5. **Retry history**: If any step failed and retried

<!-- SCREENSHOT: Workflow execution timeline showing all steps -->
<!-- SCREENSHOT: Individual step details showing input/output -->

**Notice something cool?**

- Look at step 3 ("fetch-alternatives") - it only ran because we specified dietary restrictions
- Check the logs - you'll see the AI detected "gluten" and "dairy" from our input
- The menu uses the retrieved recipes as context

This is the **agentic pattern** in action!

## Part 4: Understanding What You Built

### Durable Execution

Try this experiment:
1. Add a `throw new Error("Oops!")` in one of your steps
2. Trigger the workflow again
3. Watch Inngest automatically retry the failed step

Your previous successful steps don't re-run. This is **durable execution** - perfect for expensive operations like AI calls!

### The RAG Pattern Visualized

```
┌─────────────────────────────────────────────────┐
│  1. RETRIEVE: Search recipe database            │
│     → Returns: [Turkey, Ham, Lamb]              │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  2. AUGMENT: Provide recipes as context to LLM  │
│     Context: "Turkey with rosemary..."          │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  3. GENERATE: LLM creates elegant description   │
│     Output: "A festive feast featuring..."      │
└─────────────────────────────────────────────────┘
```

**Why this matters**: The LLM can't invent fake recipes because it only works with data you retrieved. This grounds AI generation in facts!

### The Agentic Pattern

Your workflow makes intelligent decisions:

```typescript
if (detectedAllergens.length > 0) {
  // Only fetch alternatives when needed
  alternatives = await step.run("fetch-alternatives", async () => {
    // Expensive operation only runs conditionally
  });
}
```

This is different from static workflows. Your workflow **adapts** based on runtime conditions, just like an intelligent agent!

### Project Structure Summary

Your final project structure should look like this:

```
christmas-dinner-workflow/
├── client.ts           # StepKit client configuration
├── openai.ts           # OpenAI client setup (singleton pattern)
├── data.ts             # In-memory datasets and search functions
├── services.ts         # Business logic (AI calls, data processing)
├── workflow.ts         # Workflow orchestration (step definitions)
├── main.ts             # Express server setup
├── .env                # Environment variables (OPENAI_API_KEY)
├── tsconfig.json       # TypeScript configuration
└── package.json        # Dependencies and scripts
```

**Architecture Benefits**:
- **client.ts**: Single source of truth for StepKit configuration
- **openai.ts**: Reusable OpenAI client across services
- **data.ts**: Isolated data layer (easily swap for a real database)
- **services.ts**: Testable business logic, separate from orchestration
- **workflow.ts**: Clean orchestration layer, easy to understand workflow flow
- **main.ts**: Simple server setup, can be deployed anywhere

## Part 5: Real-World Applications

This pattern works for many AI use cases:

**Customer Support Bot**:
1. Retrieve: Search knowledge base for relevant articles
2. Analyze: Use AI to understand customer intent
3. Conditional: Only escalate to human if confidence is low
4. Generate: Create helpful response with retrieved context

**Content Generation**:
1. Retrieve: Fetch product specifications from database
2. Conditional: Only run plagiarism check for public content
3. Generate: Create marketing copy grounded in real specs

**Data Processing Pipeline**:
1. Retrieve: Fetch data from API
2. Analyze: Use AI to detect anomalies
3. Conditional: Only send alerts if anomalies detected
4. Generate: Create summary report

## Key Takeaways

🎯 **StepKit provides**:
- Durable, retryable steps
- Built-in observability
- Type-safe workflows
- Flexible backend integration

🤖 **RAG Pattern**:
- Retrieve factual data first
- Provide it as context to AI
- Generate grounded outputs
- Prevent hallucination

🧠 **Agentic Pattern**:
- Make intelligent decisions at runtime
- Conditionally execute expensive operations
- Adapt workflow based on data
- Create smarter, more efficient systems

## Next Steps

**Enhance your workflow**:
1. Connect to a real vector database (Weaviate, Pinecone)
2. Add more conditional logic based on AI outputs
3. Implement streaming for real-time updates
4. Add error handling and custom retry logic

**Deploy to production**:
1. Push to GitHub
2. Deploy to Vercel/Railway/Render
3. Configure Inngest Cloud for production workflows
4. Monitor with built-in observability

## Resources

- [StepKit Documentation](https://github.com/anthropics/stepkit)
- [Inngest Documentation](https://www.inngest.com/docs)
- [OpenAI API Reference](https://platform.openai.com/docs)

---

**Congratulations!** 🎉 You've built a production-ready AI workflow with durable execution, intelligent decision-making, and the RAG pattern. You now understand the foundations of building reliable AI applications with StepKit.

Happy building! 🚀
