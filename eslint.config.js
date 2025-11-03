import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import vitest from "eslint-plugin-vitest";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.tsup/**",
      "**/coverage/**",
    ],
  },

  // Base JavaScript config
  js.configs.recommended,

  // TypeScript configs
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Global settings for TypeScript
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Custom rules
  {
    rules: {
      // Enforce consistent code style
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "warn",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      // Prevent common bugs
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-unnecessary-condition": "warn",
      "@typescript-eslint/strict-boolean-expressions": [
        "warn",
        {
          allowString: false,
          allowNumber: false,
          allowNullableObject: false,
        },
      ],

      // Code quality
      "@typescript-eslint/prefer-nullish-coalescing": "warn",
      "@typescript-eslint/prefer-optional-chain": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
        },
      ],
      "@typescript-eslint/consistent-type-exports": [
        "error",
        {
          fixMixedExportsWithInlineTypeSpecifier: true,
        },
      ],

      // Disable rules with known bugs or too strict for practical use
      "@typescript-eslint/unified-signatures": "off",
      "@typescript-eslint/consistent-type-definitions": "off", // Allow both type and interface
      "@typescript-eslint/no-non-null-assertion": "warn", // Warn instead of error

      // Disable because child classes may need to be async, but base classes
      // don't necessarily have `await` in them
      "@typescript-eslint/require-await": "off",

      // Best practices
      "no-console": ["error", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "prefer-const": "error",
      "prefer-arrow-callback": "warn",
      "object-shorthand": "warn",
      "prefer-template": "warn",
    },
  },

  // Allow console in examples
  {
    files: ["examples/**/*"],
    rules: {
      "no-console": "off",
    },
  },

  {
    files: ["**/*.test.ts"],
    plugins: {
      vitest,
    },
    rules: {
      ...vitest.configs.recommended.rules,
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/require-await": "off",
      "vitest/no-focused-tests": "error",
    },
  },

  // Disable ESLint rules that conflict with Prettier
  prettier
);
