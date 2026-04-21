import js from "@eslint/js";
import turboConfig from "eslint-config-turbo/flat";
import eslintConfigPrettier from "eslint-config-prettier";
import onlyWarn from "eslint-plugin-only-warn";
import tseslint from "typescript-eslint";

/**
 * A shared base ESLint configuration for the repository.
 * This includes Turborepo, TypeScript, and Prettier support.
 * 
 * @type {import("eslint").Linter.Config[]}
 */
export const baseConfig = [
  // 1. Turborepo recommended rules (already includes the plugin)
  ...turboConfig,

  // 2. Base JS and TypeScript recommended rules
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // 3. Prettier (turns off conflicting rules)
  eslintConfigPrettier,

  // 4. Custom Turbo overrides & Environment detection
  {
    name: "repo/base/turbo-custom",
    rules: {
      "turbo/no-undeclared-env-vars": ["error", {
        // Add variables here that don't need to be in turbo.json
        // "allowList": ["NODE_ENV", "PORT"]
      }],
    },
  },

  // 5. Global Plugin: Convert all errors to warnings (if needed)
  {
    name: "repo/base/only-warn",
    plugins: {
      "only-warn": onlyWarn,
    },
  },

  // 6. Global Ignores (Must be in a separate object)
  {
    name: "repo/base/ignores",
    ignores: ["dist/**", ".next/**", "**/.turbo/**", "**/coverage/**"],
  },
];
