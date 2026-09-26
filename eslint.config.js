import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"

// Lints the client dashboard feature: server code, Netlify functions, shared
// schemas, and the dashboard and legal UI. The pre existing marketing pages
// are outside this scope.
export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", ".netlify/**"],
  },
  {
    files: [
      "server/**/*.ts",
      "netlify/**/*.mts",
      "shared/**/*.ts",
      "src/pages/dashboard/**/*.tsx",
      "src/dashboard/**/*.{ts,tsx}",
      "src/pages/legal/**/*.tsx",
    ],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": ["error", { allow: ["info", "warn", "error"] }],
      eqeqeq: ["error", "always"],
    },
  },
)
