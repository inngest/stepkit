# Christmas Dinner RAG Workflow Example

This example demonstrates building an agentic AI workflow using StepKit and Inngest for planning a Christmas dinner. It showcases the RAG (Retrieval-Augmented Generation) pattern where the workflow dynamically fetches additional information based on conditions detected during execution.

📚 **New to StepKit?** Check out [TUTORIAL.md](./TUTORIAL.md) for a comprehensive step-by-step guide to building this workflow from scratch (~10 min read).

## Overview

The workflow implements a 6-step Christmas dinner planning process using the RAG (Retrieval-Augmented Generation) pattern:

1. **Query recipes by cuisine** - Find relevant recipes from in-memory database based on cuisine preference
2. **Analyze dietary restrictions with OpenAI** - Use GPT-4o-mini to detect allergies and special dietary needs
3. **Fetch ingredient alternatives** (conditional) - Only runs if allergies are detected
4. **Generate menu with OpenAI** - Use GPT-4o-mini to create an elegant menu from retrieved recipes (RAG!)
5. **Query wine pairings** - Find appropriate wine pairings from in-memory database
6. **Create final output with OpenAI** - Use GPT-4o-mini to generate organized shopping list

## Sample Output

```
🎄 Christmas Dinner Menu for 6 guests

1. Herb Crusted Lamb
   Cuisine: French
   Rack of lamb with herb and breadcrumb crust
   Substitutions: breadcrumbs → gluten-free breadcrumbs or almond flour or crushed rice crackers

2. Roasted Duck with Orange Sauce
   Cuisine: French
   Crispy duck with citrus glaze
   Substitutions: butter → olive oil or coconut oil or vegan butter

🍷 Wine Pairings

1. Bordeaux (Red)
   For: Herb Crusted Lamb
   Classic Bordeaux enhances the herb and garlic flavors in lamb

2. Pinot Noir (Red)
   For: Roasted Duck with Orange Sauce
   Pinot Noir's earthy notes complement duck, while its acidity cuts through the richness

🛒 Shopping List (for 6 guests)

□ chicken stock
□ coconut oil
□ dijon mustard
□ ...
```


## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set up OpenAI API Key

This example uses OpenAI's GPT-4o-mini for generating menu descriptions, analyzing dietary restrictions, and creating shopping lists.

```bash
export OPENAI_API_KEY="your-api-key-here"
```

Get your API key at [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)

### 3. Start the Server

```bash
npm run dev
```

The server will start on `http://localhost:3000`.

### 4. Start Inngest Dev Server (in a separate terminal)

```bash
npm run inngest:devserver
```

This launches the Inngest development UI at `http://localhost:8288`.

### 5. Trigger a Workflow

Open the Inngest Dev Server UI at `http://localhost:8288` and navigate to the `christmas-dinner-planner` workflow. Click "Invoke Function" and use one of these JSON payloads:

**Example 1: American cuisine with no restrictions**

```json
{
  "data": {
    "participants": 6,
    "cuisinePreference": "American"
  }
}
```

**Example 2: French cuisine with dietary restrictions**

```json
{
  "data": {
    "participants": 8,
    "cuisinePreference": "French",
    "dietaryRestrictions": "gluten-free, no dairy"
  }
}
```

**Example 3: British cuisine with nut allergies**

```json
{
  "data": {
    "participants": 4,
    "cuisinePreference": "British",
    "dietaryRestrictions": "nut allergy"
  }
}
```

**Example 4: Scandinavian cuisine for a small gathering**

```json
{
  "data": {
    "participants": 2,
    "cuisinePreference": "Scandinavian",
    "dietaryRestrictions": "no shellfish"
  }
}
```


## Learn More

- [StepKit Documentation](https://github.com/anthropics/stepkit)
- [Inngest Documentation](https://www.inngest.com/docs)
- [Original Tutorial](https://weaviate.io/blog/inngest-ai-workflows)

## License

MIT
